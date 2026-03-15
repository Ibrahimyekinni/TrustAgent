// ERC-8004 Agent Identity & Reputation utilities
// Reads from the ERC-8004 contracts on Base Sepolia

import { ethers } from "ethers";

// ── Contract addresses (Base Sepolia) ──
export const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
export const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";

// ── Minimal ABIs ──
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

// ── Read-only provider for Base Sepolia ──
let _provider;
function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  }
  return _provider;
}

function getIdentityContract() {
  return new ethers.Contract(IDENTITY_REGISTRY, IDENTITY_ABI, getProvider());
}

function getReputationContract() {
  return new ethers.Contract(REPUTATION_REGISTRY, REPUTATION_ABI, getProvider());
}

// ── Parse agent URI (handles data: URIs, IPFS, HTTPS) ──
export async function fetchAgentMetadata(uri) {
  if (!uri) return null;

  // data: URI with base64 JSON
  if (uri.startsWith("data:")) {
    const base64Part = uri.split("base64,")[1];
    if (!base64Part) return null;
    try {
      return JSON.parse(atob(base64Part));
    } catch {
      return null;
    }
  }

  // IPFS URI -- use a public gateway
  let fetchUrl = uri;
  if (uri.startsWith("ipfs://")) {
    fetchUrl = "https://ipfs.io/ipfs/" + uri.slice(7);
  }

  // HTTP/HTTPS fetch
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

// ── Get agent identity (metadata + owner) ──
export async function getAgentIdentity(agentId) {
  const identity = getIdentityContract();

  try {
    const [uri, owner] = await Promise.all([
      identity.tokenURI(agentId),
      identity.ownerOf(agentId),
    ]);

    const metadata = await fetchAgentMetadata(uri);

    return {
      agentId,
      owner,
      uri,
      name: metadata?.name || `Agent #${agentId}`,
      description: metadata?.description || "",
      image: metadata?.image || "",
      endpoints: metadata?.endpoints || metadata?.services || [],
      active: metadata?.active ?? true,
      supportedTrust: metadata?.supportedTrust || [],
      protocol: metadata?.protocol || "",
      raw: metadata,
    };
  } catch {
    return null; // Agent doesn't exist
  }
}

// ── Get agent reputation (summary + individual feedback) ──
export async function getAgentReputation(agentId) {
  const reputation = getReputationContract();

  try {
    // Get all clients who left feedback
    const clientsResult = await reputation.getClients(agentId);
    const clients = [...clientsResult]; // Spread to plain array (ethers Result is immutable)

    if (clients.length === 0) {
      return { agentId, feedbackCount: 0, avgScore: 0, clients: [], feedback: [] };
    }

    // Get summary
    const summary = await reputation.getSummary(agentId, clients, "", "");
    const count = Number(summary.count);
    const decimals = Number(summary.summaryValueDecimals);
    const avgScore = count > 0
      ? Number(summary.summaryValue) / (count * Math.pow(10, decimals))
      : 0;

    // Get individual feedback entries (limit to first 10 clients for performance)
    const feedback = [];
    for (const client of clients.slice(0, 10)) {
      try {
        const lastIdx = Number(await reputation.getLastIndex(agentId, client));
        for (let i = 1; i <= Math.min(lastIdx, 5); i++) {
          const fb = await reputation.readFeedback(agentId, client, i);
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
        // Skip failed reads
      }
    }

    return {
      agentId,
      feedbackCount: count,
      avgScore: Math.round(avgScore * 100) / 100,
      totalValue: Number(summary.summaryValue),
      valueDecimals: decimals,
      clientCount: clients.length,
      clients,
      feedback,
    };
  } catch {
    return { agentId, feedbackCount: 0, avgScore: 0, clients: [], feedback: [] };
  }
}

// ── Check if an address owns any agent identity ──
export async function lookupAgentByAddress(address) {
  // The Identity Registry is ERC-721, so we can check balanceOf
  // But we don't have an efficient reverse lookup without indexing
  // For now, we scan recent IDs (up to 500) to find a match
  const identity = getIdentityContract();

  // Try a batch approach -- check a range of agent IDs
  const batchSize = 50;
  const maxId = 500;

  for (let start = 1; start <= maxId; start += batchSize) {
    const promises = [];
    for (let id = start; id < start + batchSize && id <= maxId; id++) {
      promises.push(
        identity.ownerOf(id).then((owner) => ({ id, owner })).catch(() => null)
      );
    }
    const results = await Promise.all(promises);
    for (const r of results) {
      if (r && r.owner.toLowerCase() === address.toLowerCase()) {
        return r.id;
      }
    }
  }

  return null;
}

// ── Browse agents -- fetch a batch of agents by ID range ──
export async function browseAgents(startId = 1, count = 20) {
  const agents = [];
  const promises = [];

  for (let id = startId; id < startId + count; id++) {
    promises.push(
      getAgentIdentity(id).then((agent) => {
        if (agent) agents.push(agent);
      })
    );
  }

  await Promise.all(promises);
  return agents.sort((a, b) => a.agentId - b.agentId);
}
