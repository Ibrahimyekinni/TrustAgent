// Vercel serverless function -- uses dynamic import for ESM compatibility
let Anthropic;
async function getAnthropic() {
  if (!Anthropic) {
    const mod = await import("@anthropic-ai/sdk");
    Anthropic = mod.default || mod.Anthropic || mod;
  }
  return Anthropic;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { reviews, activeCount, revokedCount, avgRating, address } = req.body;

  if (!reviews || !Array.isArray(reviews)) {
    return res.status(400).json({ error: "Missing reviews data" });
  }

  // ── Compute quantitative trust signals ──
  const activeReviews = reviews.filter((r) => !r.revoked);
  const uniqueReviewers = new Set(activeReviews.map((r) => r.reviewer.toLowerCase())).size;
  const selfReviews = activeReviews.filter((r) => r.reviewer.toLowerCase() === address.toLowerCase()).length;
  const withProof = activeReviews.filter((r) => r.proofURI).length;

  // Time distribution analysis
  const timestamps = activeReviews.map((r) => new Date(r.date).getTime()).sort();
  let timeSpreadDays = 0;
  let burstDetected = false;
  if (timestamps.length >= 2) {
    timeSpreadDays = Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60 * 60 * 24));
    // Check for burst: 3+ reviews within 1 hour
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

  const signals = {
    totalReviews: reviews.length,
    activeCount,
    revokedCount,
    uniqueReviewers,
    selfReviews,
    withProof,
    avgRating: parseFloat(avgRating),
    timeSpreadDays,
    burstDetected,
    avgTextLength,
    revocationRatio: reviews.length > 0 ? (revokedCount / reviews.length) : 0,
    uniquenessRatio: activeCount > 0 ? (uniqueReviewers / activeCount) : 0,
  };

  // ── Compute base trust score (0-100) ──
  let score = 50; // Start neutral

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

  // Self-reviews (red flag)
  if (selfReviews > 0) score -= 20;

  // Revocation ratio
  if (signals.revocationRatio > 0.3) score -= 15;
  else if (signals.revocationRatio > 0.1) score -= 5;

  // Time spread (reviews over time = organic growth)
  if (timeSpreadDays > 30) score += 10;
  else if (timeSpreadDays > 7) score += 5;

  // Burst detection (red flag)
  if (burstDetected) score -= 10;

  // Proof of work provided
  if (withProof > 0) score += 5;

  // Review text quality
  if (avgTextLength > 100) score += 5;
  else if (avgTextLength < 20) score -= 5;

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Determine trust level
  let level;
  if (activeCount < 2) level = "Insufficient Data";
  else if (score >= 75) level = "High";
  else if (score >= 50) level = "Moderate";
  else if (score >= 30) level = "Low";
  else level = "Very Low";

  // ── AI Analysis via Claude ──
  let aiAnalysis = "";
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey && activeReviews.length > 0) {
    try {
      const AnthropicClass = await getAnthropic();
      const client = new AnthropicClass({ apiKey });

      const reviewSummary = activeReviews.slice(0, 15).map((r, i) =>
        `Review ${i + 1}: "${r.reviewText}" | Rating: ${r.rating}/5 | Project: ${r.projectName} | Reviewer: ${r.reviewer.slice(0, 10)}... | Date: ${r.date}${r.proofURI ? " | Has proof" : ""}`
      ).join("\n");

      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `You are a trust analysis agent evaluating a freelancer's on-chain reputation. Analyze these blockchain-verified reviews and give a brief, direct trust assessment in 2-3 sentences. Focus on patterns: Are reviews diverse or suspicious? Do they mention specific work? Any red flags?

Data:
- ${activeCount} active reviews, ${revokedCount} revoked
- ${uniqueReviewers} unique reviewer wallets
- ${selfReviews} self-reviews detected
- Reviews span ${timeSpreadDays} days
- ${burstDetected ? "BURST DETECTED: Multiple reviews in short time" : "No review burst detected"}
- ${withProof} reviews include proof of work
- Average review length: ${avgTextLength} characters
- Trust score: ${score}/100

Reviews:
${reviewSummary}

Give your assessment. Be direct, no fluff. If there are concerns, state them plainly. If it looks legit, say so.`
        }],
      });

      aiAnalysis = message.content[0].text;
    } catch (err) {
      // Graceful degradation -- trust score works without AI analysis
      aiAnalysis = "";
    }
  }

  return res.status(200).json({
    score,
    level,
    signals,
    aiAnalysis,
  });
}
