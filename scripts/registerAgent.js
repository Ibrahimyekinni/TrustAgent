/**
 * registerAgent.js -- Register TrustAgent as an ERC-8004 Agent
 *
 * WHAT THIS DOES:
 * Registers TrustAgent itself as an AI agent on the ERC-8004 Identity Registry
 * on Base Sepolia. This mints an NFT that represents TrustAgent's on-chain identity.
 *
 * WHY:
 * TrustAgent isn't just a UI -- it's an autonomous trust validation agent.
 * By registering it on ERC-8004, it becomes a first-class participant in the
 * agent ecosystem: discoverable, verifiable, and able to receive reputation.
 *
 * HOW TO RUN:
 *   node scripts/registerAgent.js
 */

const { ethers } = require("ethers");
require("dotenv").config();

// ERC-8004 Identity Registry on Base Sepolia
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

// Minimal ABI for registration
const IDENTITY_ABI = [
  "function register(string memory agentURI) external returns (uint256 agentId)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
];

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.log("ERROR: PRIVATE_KEY not found in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const identity = new ethers.Contract(IDENTITY_REGISTRY, IDENTITY_ABI, signer);

  console.log("");
  console.log("=== TrustAgent ERC-8004 Registration ===");
  console.log("");
  console.log("  Wallet:  " + signer.address);

  const balance = await provider.getBalance(signer.address);
  console.log("  Balance: " + ethers.formatEther(balance) + " ETH");
  console.log("  Network: Base Sepolia");
  console.log("");

  // Check if we already have an agent registered
  const existingBalance = await identity.balanceOf(signer.address);
  if (Number(existingBalance) > 0) {
    console.log("  NOTE: This wallet already owns " + existingBalance + " agent identity NFT(s).");
    console.log("  Proceeding to register a new one for TrustAgent...");
    console.log("");
  }

  // Build the ERC-8004 registration file (Agent Card)
  // Using data: URI so everything is fully on-chain -- no external hosting needed
  const registrationData = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "TrustAgent",
    description:
      "AI-powered trust validation agent. TrustAgent analyzes on-chain reputation data " +
      "from EAS attestations and the ERC-8004 Reputation Registry, detects manipulation " +
      "patterns (fake reviews, collusion, review bursts), and produces verifiable trust " +
      "scores. It serves as an independent validator in the ERC-8004 ecosystem, submitting " +
      "validation results to the Validation Registry for any agent that requests evaluation.",
    image: "https://trustagent-app.vercel.app/favicon.svg",
    services: [
      { name: "web", endpoint: "https://trustagent-app.vercel.app" },
      { name: "A2A", endpoint: "https://trustagent-app.vercel.app/api/trust-score" },
    ],
    x402Support: false,
    active: true,
    supportedTrust: ["reputation", "validation"],
    capabilities: [
      "trust-score-analysis",
      "reviewer-credibility-check",
      "collusion-detection",
      "proof-of-work-validation",
      "multi-source-reputation-aggregation",
    ],
  };

  // Encode as data: URI (base64 JSON, fully on-chain)
  const jsonStr = JSON.stringify(registrationData);
  const base64 = Buffer.from(jsonStr).toString("base64");
  const agentURI = "data:application/json;base64," + base64;

  console.log("  Agent Card:");
  console.log("    Name:        " + registrationData.name);
  console.log("    Services:    " + registrationData.services.map((s) => s.name).join(", "));
  console.log("    Trust:       " + registrationData.supportedTrust.join(", "));
  console.log("    URI type:    data: (fully on-chain)");
  console.log("");
  console.log("  Sending registration transaction...");

  const tx = await identity.register(agentURI);
  console.log("  TX hash: " + tx.hash);
  console.log("  Waiting for confirmation...");

  const receipt = await tx.wait();

  // Parse the Registered event to get the agent ID
  // The Transfer event (ERC-721) gives us the token ID
  let agentId = null;
  for (const log of receipt.logs) {
    // ERC-721 Transfer event: Transfer(address from, address to, uint256 tokenId)
    // from = 0x0 means mint
    if (log.topics.length === 4 && log.topics[0] === ethers.id("Transfer(address,address,uint256)")) {
      agentId = Number(BigInt(log.topics[3]));
      break;
    }
  }

  console.log("");
  console.log("  === REGISTRATION SUCCESSFUL ===");
  console.log("");
  if (agentId) {
    console.log("  Agent ID:    " + agentId);
    console.log("  View:        https://trustagent-app.vercel.app/agents/" + agentId);
  }
  console.log("  TX:          https://sepolia.basescan.org/tx/" + tx.hash);
  console.log("  Owner:       " + signer.address);
  console.log("");
  console.log("  TrustAgent is now a registered ERC-8004 agent!");
  console.log("  Add TRUSTAGENT_AGENT_ID=" + (agentId || "???") + " to your .env file.");
  console.log("");
}

main().catch((error) => {
  console.error("Error:", error.message || error);
  process.exit(1);
});
