// Vercel serverless function -- TrustAgent Analysis Engine v2
// Performs deep trust analysis: reviewer credibility, collusion detection,
// review-level flagging, proof validation, and structured AI assessment.

let Anthropic;
async function getAnthropic() {
  if (!Anthropic) {
    const mod = await import("@anthropic-ai/sdk");
    Anthropic = mod.default || mod.Anthropic || mod;
  }
  return Anthropic;
}

// ── EAS GraphQL helper ──
const EAS_GRAPHQL_URL = "https://base-sepolia.easscan.org/graphql";
const SCHEMA_UID_V1 = "0x5d6661abb66715bfc01d1744f52f52594c1b01ed473d9facb2825988ef70ce30";
const SCHEMA_UID_V2 = "0xb529f19655a454738a3be1bbe2c84d69d34b19cb3ca85672b005f27db42418f1";

async function fetchReviewerCredibility(reviewerAddresses) {
  // For each unique reviewer, check how many attestations THEY have received
  // A reviewer with their own reputation is more credible
  const query = `
    query GetAttestations($where: AttestationWhereInput) {
      attestations(where: $where) { id }
    }
  `;

  const credibility = {};

  // Batch check -- fetch attestation counts for each reviewer
  const promises = reviewerAddresses.map(async (addr) => {
    try {
      const [v1Res, v2Res] = await Promise.all([
        fetch(EAS_GRAPHQL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            variables: { where: { schemaId: { equals: SCHEMA_UID_V1 }, recipient: { equals: addr } } },
          }),
        }),
        fetch(EAS_GRAPHQL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            variables: { where: { schemaId: { equals: SCHEMA_UID_V2 }, recipient: { equals: addr } } },
          }),
        }),
      ]);
      const [v1, v2] = await Promise.all([v1Res.json(), v2Res.json()]);
      const count = (v1.data?.attestations?.length || 0) + (v2.data?.attestations?.length || 0);
      credibility[addr.toLowerCase()] = count;
    } catch {
      credibility[addr.toLowerCase()] = 0;
    }
  });

  await Promise.all(promises);
  return credibility;
}

async function validateProofURIs(reviews) {
  // Check if proof URIs are accessible (HEAD request)
  const results = {};
  const reviewsWithProof = reviews.filter((r) => r.proofURI && r.proofURI.startsWith("http"));

  const promises = reviewsWithProof.map(async (r, i) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(r.proofURI, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);
      results[r.uid || i] = res.ok;
    } catch {
      results[r.uid || i] = false;
    }
  });

  await Promise.all(promises);
  return results;
}

function detectCollusionRings(activeReviews, address) {
  // Check if a group of wallets are reviewing each other (mutual review ring)
  // For now, we check: do any reviewers share the same reviewer?
  // i.e., if reviewer A reviewed this freelancer, did this freelancer also review A?
  const reviewerSet = new Set(activeReviews.map((r) => r.reviewer.toLowerCase()));
  const freelancerAddr = address.toLowerCase();

  // We can't query outgoing reviews here (serverless), so we detect simpler patterns:
  // 1. Same reviewer appears multiple times
  // 2. Reviewers reviewing in rapid succession (coordinated)
  const reviewerCounts = {};
  activeReviews.forEach((r) => {
    const addr = r.reviewer.toLowerCase();
    reviewerCounts[addr] = (reviewerCounts[addr] || 0) + 1;
  });

  const duplicateReviewers = Object.entries(reviewerCounts)
    .filter(([, count]) => count > 1)
    .map(([addr, count]) => ({ address: addr, count }));

  // Check for coordinated timing: reviews from different wallets within 5 minutes
  const sortedByTime = [...activeReviews].sort((a, b) => new Date(a.date) - new Date(b.date));
  const coordinatedPairs = [];
  for (let i = 0; i < sortedByTime.length - 1; i++) {
    const t1 = new Date(sortedByTime[i].date).getTime();
    const t2 = new Date(sortedByTime[i + 1].date).getTime();
    const r1 = sortedByTime[i].reviewer.toLowerCase();
    const r2 = sortedByTime[i + 1].reviewer.toLowerCase();
    // Different reviewers, same day (date string comparison since we only have date not time)
    if (r1 !== r2 && sortedByTime[i].date === sortedByTime[i + 1].date) {
      coordinatedPairs.push({
        reviewer1: r1.slice(0, 10) + "...",
        reviewer2: r2.slice(0, 10) + "...",
        date: sortedByTime[i].date,
      });
    }
  }

  return { duplicateReviewers, coordinatedPairs };
}

function flagIndividualReviews(activeReviews, credibility) {
  // Flag individual reviews that look suspicious
  return activeReviews.map((r, i) => {
    const flags = [];
    const text = r.reviewText || "";
    const reviewerCred = credibility[r.reviewer.toLowerCase()] || 0;

    // Generic/short review
    if (text.length < 15) {
      flags.push("Very short review -- lacks detail");
    } else if (text.length < 30) {
      flags.push("Brief review -- minimal detail provided");
    }

    // Generic phrases that indicate low-effort reviews
    const genericPhrases = [
      /^(great|good|nice|awesome|excellent|amazing|perfect|best)\s*(work|job|freelancer|service|experience)?[.!]*$/i,
      /^(highly recommend|would recommend|recommended)[.!]*$/i,
      /^(very good|very nice|very professional)[.!]*$/i,
      /^(thank you|thanks)[.!]*$/i,
    ];
    if (genericPhrases.some((p) => p.test(text.trim()))) {
      flags.push("Generic review text -- no specific details about work performed");
    }

    // All caps
    if (text.length > 10 && text === text.toUpperCase()) {
      flags.push("Review is entirely uppercase");
    }

    // Reviewer has no reputation themselves
    if (reviewerCred === 0) {
      flags.push("Reviewer has no on-chain reputation -- unverified wallet");
    }

    // Perfect 5-star with very short text
    if (r.rating === 5 && text.length < 30) {
      flags.push("Perfect rating with minimal justification");
    }

    // 1-star with no explanation
    if (r.rating === 1 && text.length < 30) {
      flags.push("Lowest rating with minimal explanation");
    }

    return {
      index: i + 1,
      reviewer: r.reviewer.slice(0, 10) + "...",
      project: r.projectName,
      rating: r.rating,
      textPreview: text.length > 60 ? text.slice(0, 60) + "..." : text,
      flags,
      reviewerCredibility: reviewerCred,
      hasProof: !!r.proofURI,
    };
  });
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { reviews, activeCount, revokedCount, avgRating, address, erc8004Data } = req.body;

  if (!reviews || !Array.isArray(reviews)) {
    return res.status(400).json({ error: "Missing reviews data" });
  }

  // ── Compute quantitative trust signals ──
  const activeReviews = reviews.filter((r) => !r.revoked);
  const uniqueReviewerAddresses = [...new Set(activeReviews.map((r) => r.reviewer.toLowerCase()))];
  const uniqueReviewers = uniqueReviewerAddresses.length;
  const withProof = activeReviews.filter((r) => r.proofURI).length;

  // Time distribution analysis
  const timestamps = activeReviews.map((r) => new Date(r.date).getTime()).sort();
  let timeSpreadDays = 0;
  let burstDetected = false;
  if (timestamps.length >= 2) {
    timeSpreadDays = Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60 * 60 * 24));
    for (let i = 0; i < timestamps.length - 2; i++) {
      if (timestamps[i + 2] - timestamps[i] < 3600000) {
        burstDetected = true;
        break;
      }
    }
  }

  // Average review text length
  const avgTextLength = activeReviews.length > 0
    ? Math.round(activeReviews.reduce((sum, r) => sum + (r.reviewText || "").length, 0) / activeReviews.length)
    : 0;

  // ── Deep analysis (parallel) ──
  const [reviewerCredibility, proofValidation, collusionData] = await Promise.all([
    fetchReviewerCredibility(uniqueReviewerAddresses),
    validateProofURIs(activeReviews),
    Promise.resolve(detectCollusionRings(activeReviews, address)),
  ]);

  // Reviewer credibility stats
  const reviewersWithReputation = Object.values(reviewerCredibility).filter((c) => c > 0).length;
  const reviewersWithoutReputation = uniqueReviewers - reviewersWithReputation;

  // Proof validation stats
  const proofsChecked = Object.keys(proofValidation).length;
  const proofsValid = Object.values(proofValidation).filter(Boolean).length;
  const proofsInvalid = proofsChecked - proofsValid;

  // Flag individual reviews
  const reviewFlags = flagIndividualReviews(activeReviews, reviewerCredibility);
  const flaggedReviews = reviewFlags.filter((r) => r.flags.length > 0);

  // ── ERC-8004 signals ──
  const hasRegisteredIdentity = !!(erc8004Data && erc8004Data.identity && erc8004Data.identity.name);
  const erc8004FeedbackCount = erc8004Data?.reputation?.feedbackCount || 0;
  const erc8004AvgScore = erc8004Data?.reputation?.avgScore || 0;
  const erc8004ClientCount = erc8004Data?.reputation?.clientCount || 0;
  const hasMultiSourceData = hasRegisteredIdentity && activeReviews.length > 0;

  const signals = {
    totalReviews: reviews.length,
    activeCount,
    revokedCount,
    uniqueReviewers,
    withProof,
    avgRating: parseFloat(avgRating),
    timeSpreadDays,
    burstDetected,
    avgTextLength,
    revocationRatio: reviews.length > 0 ? (revokedCount / reviews.length) : 0,
    uniquenessRatio: activeCount > 0 ? (uniqueReviewers / activeCount) : 0,
    // Deep signals
    reviewersWithReputation,
    reviewersWithoutReputation,
    proofsValid,
    proofsInvalid,
    duplicateReviewers: collusionData.duplicateReviewers.length,
    coordinatedReviews: collusionData.coordinatedPairs.length,
    flaggedReviewCount: flaggedReviews.length,
    // ERC-8004 signals
    hasRegisteredIdentity,
    erc8004FeedbackCount,
    erc8004AvgScore,
    erc8004ClientCount,
    hasMultiSourceData,
  };

  // ── Compute trust score (0-100) ──
  let score = 50;

  // Unique reviewers (most important signal)
  if (signals.uniquenessRatio >= 0.9) score += 15;
  else if (signals.uniquenessRatio >= 0.7) score += 10;
  else if (signals.uniquenessRatio >= 0.5) score += 5;
  else score -= 15;

  // Volume
  if (activeCount >= 10) score += 10;
  else if (activeCount >= 5) score += 7;
  else if (activeCount >= 3) score += 3;
  else score -= 5;

  // Revocation ratio
  if (signals.revocationRatio > 0.3) score -= 15;
  else if (signals.revocationRatio > 0.1) score -= 5;

  // Time spread (reviews over time = organic growth)
  if (timeSpreadDays > 30) score += 10;
  else if (timeSpreadDays > 7) score += 5;

  // Burst detection
  if (burstDetected) score -= 10;

  // Proof of work provided
  if (withProof > 0) score += 5;
  // Bonus: proofs are actually valid/accessible
  if (proofsValid > 0) score += 3;
  // Penalty: proofs claimed but broken
  if (proofsInvalid > 0) score -= 5;

  // Review text quality
  if (avgTextLength > 100) score += 5;
  else if (avgTextLength < 20) score -= 5;

  // Reviewer credibility (NEW -- big signal)
  if (reviewersWithReputation > 0) {
    const credRatio = reviewersWithReputation / uniqueReviewers;
    if (credRatio >= 0.5) score += 10;
    else if (credRatio >= 0.25) score += 5;
  }
  if (reviewersWithoutReputation === uniqueReviewers && uniqueReviewers > 1) {
    score -= 8; // ALL reviewers are fresh wallets -- suspicious
  }

  // Collusion signals
  if (collusionData.duplicateReviewers.length > 0) score -= 10;
  if (collusionData.coordinatedPairs.length > 0) score -= 5;

  // High flag ratio
  if (flaggedReviews.length > 0 && activeReviews.length > 0) {
    const flagRatio = flaggedReviews.length / activeReviews.length;
    if (flagRatio > 0.5) score -= 10;
    else if (flagRatio > 0.25) score -= 5;
  }

  // ERC-8004 signals
  if (hasRegisteredIdentity) score += 8; // Registered on-chain identity is a strong signal
  if (erc8004FeedbackCount > 0) {
    if (erc8004FeedbackCount >= 5) score += 7;
    else if (erc8004FeedbackCount >= 2) score += 4;
    else score += 2;
  }
  if (hasMultiSourceData) score += 5; // Multi-source corroboration bonus

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Determine trust level
  let level;
  if (activeCount < 2) level = "Insufficient Data";
  else if (score >= 75) level = "High";
  else if (score >= 50) level = "Moderate";
  else if (score >= 30) level = "Low";
  else level = "Very Low";

  // ── Structured AI Analysis via Claude ──
  let report = null;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey && activeReviews.length > 0) {
    try {
      const AnthropicClass = await getAnthropic();
      const client = new AnthropicClass({ apiKey });

      const reviewDetails = activeReviews.slice(0, 15).map((r, i) => {
        const rf = reviewFlags[i];
        return `Review #${i + 1}: "${r.reviewText}" | Rating: ${r.rating}/5 | Project: ${r.projectName} | Reviewer: ${r.reviewer.slice(0, 10)}... | Date: ${r.date}${r.proofURI ? " | Proof: " + r.proofURI : " | No proof"}${rf.reviewerCredibility > 0 ? ` | Reviewer has ${rf.reviewerCredibility} reviews on their own profile` : " | Reviewer has zero reputation"}${rf.flags.length > 0 ? ` | FLAGS: ${rf.flags.join("; ")}` : ""}`;
      }).join("\n");

      const collusionInfo = collusionData.duplicateReviewers.length > 0
        ? `\nCOLLUSION ALERT: ${collusionData.duplicateReviewers.map((d) => `${d.address.slice(0, 10)}... reviewed ${d.count} times`).join(", ")}`
        : "";

      const coordinatedInfo = collusionData.coordinatedPairs.length > 0
        ? `\nCOORDINATED REVIEWS: ${collusionData.coordinatedPairs.map((p) => `${p.reviewer1} and ${p.reviewer2} reviewed on same day (${p.date})`).join(", ")}`
        : "";

      // ERC-8004 context for the AI prompt
      const erc8004Context = hasRegisteredIdentity
        ? `\nERC-8004 IDENTITY (On-Chain Agent Registry):
- Registered Name: ${erc8004Data.identity.name}
- Description: ${erc8004Data.identity.description || "None"}
- Agent ID: ${erc8004Data.identity.agentId}
- Active: ${erc8004Data.identity.active ? "Yes" : "No"}
- Protocol: ${erc8004Data.identity.protocol || "Unknown"}
- ERC-8004 Feedback: ${erc8004FeedbackCount} entries from ${erc8004ClientCount} unique clients
- ERC-8004 Avg Score: ${erc8004AvgScore}
- MULTI-SOURCE: This entity has reputation data from BOTH EAS attestations AND the ERC-8004 Reputation Registry. Cross-reference both sources in your analysis.`
        : erc8004Data === null
          ? "\nERC-8004: This wallet has NO registered identity in the ERC-8004 Agent Registry."
          : "";

      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `You are a blockchain trust analysis agent performing a deep investigation of an entity's on-chain reputation across multiple registries. You must return a structured JSON report.

INVESTIGATION DATA:
- Wallet: ${address.slice(0, 10)}...
- EAS Attestations: ${activeCount} active reviews, ${revokedCount} revoked
- ${uniqueReviewers} unique reviewer wallets (${reviewersWithReputation} have their own reputation, ${reviewersWithoutReputation} are fresh/unverified wallets)
- Reviews span ${timeSpreadDays} days
- ${burstDetected ? "BURST DETECTED: Multiple reviews in short time" : "No review burst detected"}
- ${withProof} reviews include proof of work (${proofsValid} verified accessible, ${proofsInvalid} broken/inaccessible)
- Average review length: ${avgTextLength} characters
- ${flaggedReviews.length}/${activeReviews.length} reviews have flags
- Computed trust score: ${score}/100${collusionInfo}${coordinatedInfo}${erc8004Context}

EAS REVIEWS:
${reviewDetails}

Return ONLY valid JSON with this exact structure (no markdown, no code fences):
{
  "verdict": "TRUSTWORTHY" or "CAUTIOUS" or "SUSPICIOUS" or "UNRELIABLE",
  "confidence": "high" or "medium" or "low",
  "summary": "2-3 sentence executive summary. Be specific about what you found. Reference actual review content and patterns.",
  "credibilityFactors": ["list of 2-4 specific positive trust indicators found, or empty array if none"],
  "riskFactors": ["list of 2-4 specific risk factors or concerns found, or empty array if none"],
  "flaggedReviews": [{"index": 1, "reason": "why this specific review is suspicious"}],
  "recommendation": "One clear, actionable sentence: should someone trust this entity based on the evidence?"
}`
        }],
      });

      // Parse the structured response
      const rawText = message.content[0].text.trim();
      try {
        report = JSON.parse(rawText);
      } catch {
        // If Claude didn't return valid JSON, try to extract it
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            report = JSON.parse(jsonMatch[0]);
          } catch {
            report = null;
          }
        }
      }
    } catch {
      // Graceful degradation -- quantitative analysis still works
      report = null;
    }
  }

  return res.status(200).json({
    score,
    level,
    signals,
    report,
    reviewFlags,
    collusionData: {
      duplicateReviewers: collusionData.duplicateReviewers,
      coordinatedPairs: collusionData.coordinatedPairs,
    },
  });
}
