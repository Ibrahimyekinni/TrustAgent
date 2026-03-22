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

      // Fetch validation attestations to attach badges
      const VALIDATION_SCHEMA = "0xc58d7a957517d2d26433311d878f926f4fe2ca91445186a3976d5f354206b6b0";
      const TRUSTAGENT_WALLET = "0x12e38f09f8d39Ba1B18Ec2d158cAB0DD92D45eEa";
      const EAS_GRAPHQL = "https://base-sepolia.easscan.org/graphql";

      try {
        const valQuery = `
          query GetAllValidations($where: AttestationWhereInput) {
            attestations(where: $where, orderBy: [{ time: desc }]) {
              id
              recipient
              data
            }
          }
        `;
        const valRes = await fetch(EAS_GRAPHQL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: valQuery,
            variables: {
              where: {
                schemaId: { equals: VALIDATION_SCHEMA },
                attester: { equals: TRUSTAGENT_WALLET },
                revocationTime: { equals: 0 },
              },
            },
          }),
        });
        const valData = await valRes.json();
        if (valData.data?.attestations) {
          // Build lookup: latest validation per recipient
          const validationMap = {};
          for (const a of valData.data.attestations) {
            const addr = a.recipient.toLowerCase();
            if (validationMap[addr]) continue; // already have latest
            try {
              const { AbiCoder } = ethers;
              const decoded = AbiCoder.defaultAbiCoder().decode(
                ["uint256", "uint8", "string", "string"],
                a.data
              );
              validationMap[addr] = {
                score: Number(decoded[1]),
                verdict: decoded[2],
                uid: a.id,
              };
            } catch { /* skip */ }
          }
          // Attach to agents
          for (const agent of agents) {
            const v = validationMap[agent.owner?.toLowerCase()];
            if (v) agent.validation = v;
          }
        }
      } catch { /* non-critical, badges just won't show */ }

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

      // Tag-based multi-dimensional reputation
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

      return res.status(200).json({
        agentId: id,
        feedbackCount,
        avgScore: Math.round(avgScore * 100) / 100,
        clientCount: clients.length,
        clients,
        feedback,
        dimensions,
      });
    }

    // ── Search by wallet address ──
    if (action === "search" && address) {
      // Scan agent IDs to find one owned by this address
      const maxScan = 2000;
      const batchSize = 100;

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

    // ── Stats: live on-chain stats for the Home page ──
    if (action === "stats") {
      const VALIDATION_SCHEMA = "0xc58d7a957517d2d26433311d878f926f4fe2ca91445186a3976d5f354206b6b0";
      const SCHEMA_UID_V1 = "0x5d6661abb66715bfc01d1744f52f52594c1b01ed473d9facb2825988ef70ce30";
      const SCHEMA_UID_V2 = "0xb529f19655a454738a3be1bbe2c84d69d34b19cb3ca85672b005f27db42418f1";
      const TRUSTAGENT_WALLET = "0x12e38f09f8d39Ba1B18Ec2d158cAB0DD92D45eEa";
      const EAS_GRAPHQL = "https://base-sepolia.easscan.org/graphql";

      const countQuery = `
        query CountAttestations($where: AttestationWhereInput) {
          aggregateAttestation(where: $where) { _count { id } }
        }
      `;

      const recipientsQuery = `
        query GetRecipients($where: AttestationWhereInput) {
          attestations(where: $where) { recipient }
        }
      `;

      const [v1Count, v2Count, valCount, v1Recipients, v2Recipients] = await Promise.all([
        fetch(EAS_GRAPHQL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: countQuery, variables: { where: { schemaId: { equals: SCHEMA_UID_V1 }, revocationTime: { equals: 0 } } } }),
        }).then(r => r.json()),
        fetch(EAS_GRAPHQL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: countQuery, variables: { where: { schemaId: { equals: SCHEMA_UID_V2 }, revocationTime: { equals: 0 } } } }),
        }).then(r => r.json()),
        fetch(EAS_GRAPHQL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: countQuery, variables: { where: { schemaId: { equals: VALIDATION_SCHEMA }, attester: { equals: TRUSTAGENT_WALLET }, revocationTime: { equals: 0 } } } }),
        }).then(r => r.json()),
        fetch(EAS_GRAPHQL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: recipientsQuery, variables: { where: { schemaId: { equals: SCHEMA_UID_V1 }, revocationTime: { equals: 0 } } } }),
        }).then(r => r.json()),
        fetch(EAS_GRAPHQL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: recipientsQuery, variables: { where: { schemaId: { equals: SCHEMA_UID_V2 }, revocationTime: { equals: 0 } } } }),
        }).then(r => r.json()),
      ]);

      const totalReviews = (v1Count.data?.aggregateAttestation?._count?.id || 0) + (v2Count.data?.aggregateAttestation?._count?.id || 0);
      const totalValidations = valCount.data?.aggregateAttestation?._count?.id || 0;

      const allRecipients = new Set();
      for (const a of (v1Recipients.data?.attestations || [])) allRecipients.add(a.recipient.toLowerCase());
      for (const a of (v2Recipients.data?.attestations || [])) allRecipients.add(a.recipient.toLowerCase());
      const uniqueEntities = allRecipients.size;

      res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=60");
      return res.status(200).json({ totalReviews, totalValidations, uniqueEntities, totalAttestations: totalReviews + totalValidations });
    }

    // ── Validations: fetch TrustAgent validation history for an address ──
    if (action === "validations" && address) {
      const VALIDATION_SCHEMA = "0xc58d7a957517d2d26433311d878f926f4fe2ca91445186a3976d5f354206b6b0";
      const TRUSTAGENT_WALLET = "0x12e38f09f8d39Ba1B18Ec2d158cAB0DD92D45eEa";
      const EAS_GRAPHQL = "https://base-sepolia.easscan.org/graphql";

      const query = `
        query GetValidations($where: AttestationWhereInput) {
          attestations(where: $where, orderBy: [{ time: desc }]) {
            id
            time
            revocationTime
            data
            recipient
          }
        }
      `;

      const gqlRes = await fetch(EAS_GRAPHQL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          variables: {
            where: {
              schemaId: { equals: VALIDATION_SCHEMA },
              attester: { equals: TRUSTAGENT_WALLET },
              recipient: { equals: address },
            },
          },
        }),
      });

      const gqlData = await gqlRes.json();
      if (gqlData.errors) throw new Error(gqlData.errors[0].message);

      const validations = (gqlData.data.attestations || [])
        .filter((a) => a.revocationTime === 0 || a.revocationTime === "0")
        .map((a) => {
          let agentId = 0, trustScore = 0, verdict = "", reportHash = "";
          try {
            const { AbiCoder } = ethers;
            const decoded = AbiCoder.defaultAbiCoder().decode(
              ["uint256", "uint8", "string", "string"],
              a.data
            );
            agentId = Number(decoded[0]);
            trustScore = Number(decoded[1]);
            verdict = decoded[2];
            reportHash = decoded[3];
          } catch {
            // Skip decode errors
          }
          return {
            uid: a.id,
            date: new Date(parseInt(a.time) * 1000).toISOString(),
            agentId,
            trustScore,
            verdict,
            reportHash,
          };
        });

      return res.status(200).json({ validations });
    }

    return res.status(400).json({ error: "Invalid action. Use: browse, identity, reputation, search, validations" });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
