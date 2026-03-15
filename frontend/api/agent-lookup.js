// Vercel serverless function -- ERC-8004 Agent Lookup
// Server-side queries to avoid browser CORS issues with RPC calls

let ethersModule;
async function getEthers() {
  if (!ethersModule) {
    ethersModule = await import("ethers");
  }
  return ethersModule;
}

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";
const RPC_URL = "https://sepolia.base.org";

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

async function parseAgentURI(uri) {
  if (!uri) return null;

  if (uri.startsWith("data:")) {
    const base64Part = uri.split("base64,")[1];
    if (!base64Part) return null;
    try {
      return JSON.parse(Buffer.from(base64Part, "base64").toString());
    } catch {
      return null;
    }
  }

  let fetchUrl = uri;
  if (uri.startsWith("ipfs://")) {
    fetchUrl = "https://ipfs.io/ipfs/" + uri.slice(7);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(fetchUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { action, agentId, address, start, count } = req.query;
  const { ethers } = await getEthers();
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const identity = new ethers.Contract(IDENTITY_REGISTRY, IDENTITY_ABI, provider);
  const reputation = new ethers.Contract(REPUTATION_REGISTRY, REPUTATION_ABI, provider);

  try {
    // ── Browse: list agents by ID range ──
    if (action === "browse") {
      const startId = parseInt(start) || 1;
      const batchCount = Math.min(parseInt(count) || 20, 50);
      const agents = [];

      const promises = [];
      for (let id = startId; id < startId + batchCount; id++) {
        promises.push(
          (async () => {
            try {
              const [uri, owner] = await Promise.all([
                identity.tokenURI(id),
                identity.ownerOf(id),
              ]);
              const metadata = await parseAgentURI(uri);
              return {
                agentId: id,
                owner,
                name: metadata?.name || `Agent #${id}`,
                description: metadata?.description || "",
                image: metadata?.image || "",
                active: metadata?.active ?? true,
                protocol: metadata?.protocol || "",
              };
            } catch {
              return null;
            }
          })()
        );
      }

      const results = await Promise.all(promises);
      for (const r of results) {
        if (r) agents.push(r);
      }

      return res.status(200).json({ agents: agents.sort((a, b) => a.agentId - b.agentId) });
    }

    // ── Identity: get single agent details ──
    if (action === "identity" && agentId) {
      const id = parseInt(agentId);
      const [uri, owner] = await Promise.all([
        identity.tokenURI(id),
        identity.ownerOf(id),
      ]);
      const metadata = await parseAgentURI(uri);

      return res.status(200).json({
        agentId: id,
        owner,
        uri,
        name: metadata?.name || `Agent #${id}`,
        description: metadata?.description || "",
        image: metadata?.image || "",
        endpoints: metadata?.endpoints || metadata?.services || [],
        active: metadata?.active ?? true,
        supportedTrust: metadata?.supportedTrust || [],
        protocol: metadata?.protocol || "",
        raw: metadata,
      });
    }

    // ── Reputation: get agent reputation data ──
    if (action === "reputation" && agentId) {
      const id = parseInt(agentId);
      const clientsResult = await reputation.getClients(id);
      const clients = [...clientsResult];

      if (clients.length === 0) {
        return res.status(200).json({ agentId: id, feedbackCount: 0, avgScore: 0, clients: [], feedback: [] });
      }

      const summary = await reputation.getSummary(id, clients, "", "");
      const feedbackCount = Number(summary.count);
      const decimals = Number(summary.summaryValueDecimals);
      const avgScore = feedbackCount > 0
        ? Number(summary.summaryValue) / (feedbackCount * Math.pow(10, decimals))
        : 0;

      // Individual feedback (limit to 10 clients, 5 entries each)
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
              rawValue: Number(fb.value),
              valueDecimals: fbDecimals,
              tag1: fb.tag1,
              tag2: fb.tag2,
              revoked: fb.isRevoked,
            });
          }
        } catch {
          // Skip
        }
      }

      return res.status(200).json({
        agentId: id,
        feedbackCount,
        avgScore: Math.round(avgScore * 100) / 100,
        clientCount: clients.length,
        clients,
        feedback,
      });
    }

    // ── Search by wallet address ──
    if (action === "search" && address) {
      // Scan agent IDs to find one owned by this address
      const maxScan = 300;
      const batchSize = 50;

      for (let start = 1; start <= maxScan; start += batchSize) {
        const checks = [];
        for (let id = start; id < start + batchSize && id <= maxScan; id++) {
          checks.push(
            identity.ownerOf(id).then((owner) => ({ id, owner })).catch(() => null)
          );
        }
        const results = await Promise.all(checks);
        for (const r of results) {
          if (r && r.owner.toLowerCase() === address.toLowerCase()) {
            // Found -- fetch full identity
            const [uri] = await Promise.all([identity.tokenURI(r.id)]);
            const metadata = await parseAgentURI(uri);
            return res.status(200).json({
              found: true,
              agentId: r.id,
              owner: r.owner,
              name: metadata?.name || `Agent #${r.id}`,
              description: metadata?.description || "",
              image: metadata?.image || "",
            });
          }
        }
      }

      return res.status(200).json({ found: false });
    }

    return res.status(400).json({ error: "Invalid action. Use: browse, identity, reputation, search" });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
