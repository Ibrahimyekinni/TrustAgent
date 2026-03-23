// Vercel serverless function -- TrustAgent Validation Engine
// TrustAgent acts as an autonomous trust validator: it analyzes an ERC-8004 agent's
// reputation data, produces a trust score, and records the validation result on-chain
// as an EAS attestation. This makes TrustAgent a verifiable, on-chain validation agent.

let ethersModule;
async function getEthers() {
  if (!ethersModule) ethersModule = await import("ethers");
  return ethersModule;
}

let Anthropic;
async function getAnthropic() {
  if (!Anthropic) {
    const mod = await import("@anthropic-ai/sdk");
    Anthropic = mod.default || mod.Anthropic || mod;
  }
  return Anthropic;
}

// ── Contract addresses (Base Sepolia) ──
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";
const EAS_CONTRACT = "0x4200000000000000000000000000000000000021";
const VALIDATION_SCHEMA_UID = "0xc58d7a957517d2d26433311d878f926f4fe2ca91445186a3976d5f354206b6b0";
const RPC_URL = "https://sepolia.base.org";

// TrustAgent's own ERC-8004 agent ID
const TRUSTAGENT_AGENT_ID = 1886;

const IDENTITY_ABI = [
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
];

const REPUTATION_ABI = [
  "function getSummary(uint256 agentId, address[] calldata clientAddresses, string calldata tag1, string calldata tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
  "function getClients(uint256 agentId) view returns (address[])",
  "function getLastIndex(uint256 agentId, address clientAddress) view returns (uint64)",
  "function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex) view returns (int128 value, uint8 valueDecimals, string tag1, string tag2, bool isRevoked)",
];

const EAS_ABI = [
  "function attest((bytes32 schema, (address recipient, uint64 expirationTime, bool revocable, bytes32 refUID, bytes data, uint256 value) data)) external payable returns (bytes32)",
];

async function parseAgentURI(uri) {
  if (!uri) return null;
  if (uri.startsWith("data:")) {
    const base64Part = uri.split("base64,")[1];
    if (!base64Part) return null;
    try { return JSON.parse(Buffer.from(base64Part, "base64").toString()); }
    catch { return null; }
  }
  let fetchUrl = uri;
  if (uri.startsWith("ipfs://")) fetchUrl = "https://ipfs.io/ipfs/" + uri.slice(7);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(fetchUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { agentId } = req.body;
  if (!agentId || isNaN(parseInt(agentId))) {
    return res.status(400).json({ error: "Missing or invalid agentId" });
  }

  const id = parseInt(agentId);
  const { ethers } = await getEthers();
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const identity = new ethers.Contract(IDENTITY_REGISTRY, IDENTITY_ABI, provider);
  const reputation = new ethers.Contract(REPUTATION_REGISTRY, REPUTATION_ABI, provider);

  try {
    // ── Step 1: Fetch agent identity from ERC-8004 ──
    let agentIdentity = null;
    try {
      const [uri, owner] = await Promise.all([
        identity.tokenURI(id),
        identity.ownerOf(id),
      ]);
      const metadata = await parseAgentURI(uri);
      agentIdentity = {
        agentId: id,
        owner,
        name: metadata?.name || `Agent #${id}`,
        description: metadata?.description || "",
        image: metadata?.image || "",
        active: metadata?.active ?? true,
        supportedTrust: metadata?.supportedTrust || [],
        services: metadata?.services || [],
      };
    } catch {
      return res.status(404).json({ error: "Agent not found in ERC-8004 Identity Registry" });
    }

    // ── Step 2: Fetch agent reputation from ERC-8004 ──
    let reputationData = { feedbackCount: 0, avgScore: 0, clientCount: 0, feedback: [] };
    try {
      const clientsResult = await reputation.getClients(id);
      const clients = [...clientsResult];

      if (clients.length > 0) {
        const summary = await reputation.getSummary(id, clients, "", "");
        const feedbackCount = Number(summary.count);
        const decimals = Number(summary.summaryValueDecimals);
        const avgScore = feedbackCount > 0
          ? Number(summary.summaryValue) / (feedbackCount * Math.pow(10, decimals))
          : 0;

        const feedback = [];
        for (const client of clients.slice(0, 10)) {
          try {
            const lastIdx = Number(await reputation.getLastIndex(id, client));
            for (let i = 1; i <= Math.min(lastIdx, 5); i++) {
              const fb = await reputation.readFeedback(id, client, i);
              const fbDecimals = Number(fb.valueDecimals);
              feedback.push({
                client,
                index: i,
                value: Number(fb.value) / Math.pow(10, fbDecimals),
                tag1: fb.tag1,
                tag2: fb.tag2,
                revoked: fb.isRevoked,
              });
            }
          } catch { /* skip */ }
        }

        // Tag-based dimensional queries
        const dimensions = [];
        const uniqueTags = new Set();
        for (const fb of feedback) {
          if (fb.tag1 && !fb.revoked) uniqueTags.add(fb.tag1);
        }
        if (uniqueTags.size > 0) {
          const tagPromises = [...uniqueTags].slice(0, 8).map(async (tag) => {
            try {
              const tagSummary = await reputation.getSummary(id, clients, tag, "");
              const tagCount = Number(tagSummary.count);
              if (tagCount === 0) return null;
              const tagDecimals = Number(tagSummary.summaryValueDecimals);
              const tagAvg = Number(tagSummary.summaryValue) / (tagCount * Math.pow(10, tagDecimals));
              return { tag, count: tagCount, avgScore: Math.round(tagAvg * 100) / 100 };
            } catch { return null; }
          });
          const tagResults = await Promise.all(tagPromises);
          for (const r of tagResults) {
            if (r) dimensions.push(r);
          }
        }

        reputationData = {
          feedbackCount,
          avgScore: Math.round(avgScore * 100) / 100,
          clientCount: clients.length,
          feedback,
          dimensions,
        };
      }
    } catch { /* no reputation data */ }

    // ── Step 3: Compute trust score ──
    let score = 50;

    // Identity signals
    if (agentIdentity.name && agentIdentity.name !== `Agent #${id}`) score += 5;
    if (agentIdentity.description && agentIdentity.description.length > 50) score += 5;
    if (agentIdentity.active) score += 3;
    if (agentIdentity.services && agentIdentity.services.length > 0) score += 5;
    if (agentIdentity.supportedTrust && agentIdentity.supportedTrust.length > 0) score += 3;

    // Reputation signals
    const revokedFeedback = reputationData.feedback.filter(f => f.revoked);
    const activeFeedback = reputationData.feedback.filter(f => !f.revoked);
    const positiveFeedback = activeFeedback.filter(f => f.value > 0);
    const positiveRatio = activeFeedback.length > 0
      ? positiveFeedback.length / activeFeedback.length
      : 0;

    if (reputationData.feedbackCount > 0) {
      if (reputationData.feedbackCount >= 10) score += 12;
      else if (reputationData.feedbackCount >= 5) score += 8;
      else if (reputationData.feedbackCount >= 2) score += 5;
      else score += 2;
    } else {
      score -= 10; // No reputation data is a risk factor
    }

    // Sentiment: use positive/negative ratio instead of raw avg
    // (ERC-8004 feedback values use different scales per tag, so raw avg is unreliable)
    if (activeFeedback.length > 0) {
      if (positiveRatio >= 0.9) score += 8;
      else if (positiveRatio >= 0.7) score += 4;
      else if (positiveRatio < 0.5) score -= 8;
    }

    if (reputationData.clientCount >= 3) score += 5;
    else if (reputationData.clientCount >= 2) score += 3;

    // Check for revoked feedback
    if (revokedFeedback.length > 0 && reputationData.feedback.length > 0) {
      const revokeRatio = revokedFeedback.length / reputationData.feedback.length;
      if (revokeRatio > 0.3) score -= 10;
      else score -= 3;
    }

    // No metadata = suspicious
    if (!agentIdentity.description) score -= 5;

    score = Math.max(0, Math.min(100, score));

    // Determine verdict
    let verdict;
    if (reputationData.feedbackCount === 0 && !agentIdentity.description) verdict = "INSUFFICIENT_DATA";
    else if (score >= 75) verdict = "TRUSTWORTHY";
    else if (score >= 50) verdict = "CAUTIOUS";
    else if (score >= 30) verdict = "SUSPICIOUS";
    else verdict = "UNRELIABLE";

    // ── Step 4: AI analysis ──
    let aiReport = null;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (apiKey) {
      try {
        const AnthropicClass = await getAnthropic();
        const client = new AnthropicClass({ apiKey });

        const feedbackDetails = reputationData.feedback.slice(0, 10).map((f, i) =>
          `  ${i + 1}. Score: ${f.value} | Tags: ${f.tag1 || "none"}, ${f.tag2 || "none"} | From: ${f.client.slice(0, 10)}... | Revoked: ${f.revoked}`
        ).join("\n");

        const message = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 600,
          messages: [{
            role: "user",
            content: `You are TrustAgent (ERC-8004 Agent #${TRUSTAGENT_AGENT_ID}), an autonomous AI trust validator. You are performing an official validation of another agent registered on the ERC-8004 Identity Registry. Your validation will be recorded on-chain as an EAS attestation.

AGENT UNDER EVALUATION:
- Agent ID: ${id}
- Name: ${agentIdentity.name}
- Description: ${agentIdentity.description || "None provided"}
- Active: ${agentIdentity.active}
- Services: ${agentIdentity.services?.map(s => s.name).join(", ") || "None listed"}
- Supported Trust Models: ${agentIdentity.supportedTrust?.join(", ") || "None declared"}
- Owner: ${agentIdentity.owner}

ERC-8004 REPUTATION DATA:
- Total Feedback: ${reputationData.feedbackCount}
- Positive Feedback Ratio: ${activeFeedback.length > 0 ? Math.round(positiveRatio * 100) + "%" : "N/A"} (${positiveFeedback.length} positive out of ${activeFeedback.length} active entries)
- Unique Clients: ${reputationData.clientCount}
- Revoked Feedback: ${revokedFeedback.length}
NOTE: ERC-8004 feedback uses different value scales per tag (e.g. quality scores, glicko ratings, win rates). Do NOT compare raw values across tags or treat the numeric average as a 0-100 rating. Focus on the positive/negative ratio and volume instead.
${feedbackDetails ? "Feedback Entries:\n" + feedbackDetails : "No feedback entries found."}
${reputationData.dimensions && reputationData.dimensions.length > 0 ? "\nMULTI-DIMENSIONAL REPUTATION (ERC-8004 tag-based):\n" + reputationData.dimensions.map(d => `  - ${d.tag}: avg ${d.avgScore} across ${d.count} entries`).join("\n") + "\nNote: Each dimension uses its own scale. Higher values within the same tag indicate better performance for that metric." : ""}
COMPUTED TRUST SCORE: ${score}/100
VERDICT: ${verdict}

Return ONLY valid JSON (no markdown, no code fences):
{
  "summary": "2-3 sentence analysis of this agent's trustworthiness based on identity completeness, reputation data, and any red flags",
  "strengths": ["list of 1-3 positive trust indicators"],
  "risks": ["list of 1-3 risk factors or concerns"],
  "recommendation": "One clear sentence: should other agents or users trust this agent?"
}`
          }],
        });

        const rawText = message.content[0].text.trim();
        try {
          aiReport = JSON.parse(rawText);
        } catch {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) try { aiReport = JSON.parse(jsonMatch[0]); } catch { /* ignore */ }
        }
      } catch { /* AI analysis failed, continue without it */ }
    }

    // ── Step 5: Record validation on-chain as EAS attestation ──
    let attestationResult = null;
    const privateKey = process.env.PRIVATE_KEY?.trim();

    if (privateKey) {
      try {
        const keyHex = privateKey.startsWith("0x") ? privateKey : "0x" + privateKey;
        const signer = new ethers.Wallet(keyHex, provider);

        // Encode the validation schema data
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const reportObj = {
          score,
          verdict,
          identity: agentIdentity.name,
          feedbackCount: reputationData.feedbackCount,
          avgScore: reputationData.avgScore,
          ai: aiReport?.summary || "",
        };
        const reportHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(reportObj)));

        const encodedData = abiCoder.encode(
          ["uint256", "uint8", "string", "string"],
          [id, score, verdict, reportHash]
        );

        // The recipient is the agent's owner address
        const attestationRequest = {
          schema: VALIDATION_SCHEMA_UID,
          data: {
            recipient: agentIdentity.owner,
            expirationTime: 0n,
            revocable: true,
            refUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
            data: encodedData,
            value: 0n,
          },
        };

        const easContract = new ethers.Contract(EAS_CONTRACT, EAS_ABI, signer);
        const tx = await easContract.attest(attestationRequest);
        const receipt = await tx.wait();

        // Extract attestation UID from logs
        let attestationUID = "";
        for (const log of receipt.logs) {
          if (log.topics.length >= 4) {
            attestationUID = log.data.slice(0, 66);
            break;
          }
        }

        attestationResult = {
          attestationUID,
          txHash: receipt.hash,
          validator: signer.address,
          validatorAgentId: TRUSTAGENT_AGENT_ID,
          schema: VALIDATION_SCHEMA_UID,
          easScanUrl: attestationUID
            ? `https://base-sepolia.easscan.org/attestation/view/${attestationUID}`
            : null,
          baseScanUrl: `https://sepolia.basescan.org/tx/${receipt.hash}`,
        };
      } catch (err) {
        // On-chain attestation failed, but we still return the analysis
        attestationResult = { error: err.message || "Failed to submit on-chain attestation" };
      }
    }

    // ── Return full validation result ──
    return res.status(200).json({
      agent: agentIdentity,
      reputation: reputationData,
      validation: {
        score,
        verdict,
        validatedBy: {
          name: "TrustAgent",
          agentId: TRUSTAGENT_AGENT_ID,
          type: "AI Trust Validator",
        },
        timestamp: new Date().toISOString(),
      },
      aiReport,
      attestation: attestationResult,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Validation failed" });
  }
}
