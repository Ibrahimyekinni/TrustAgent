/**
 * registerValidationSchema.js
 *
 * Registers the TrustAgent Validation schema on EAS.
 * This schema records when TrustAgent (as an AI trust validator) evaluates
 * an ERC-8004 agent and produces a trust score.
 *
 * Schema: uint256 agentId, uint8 trustScore, string verdict, string reportHash
 *
 * - agentId: The ERC-8004 agent ID that was validated
 * - trustScore: 0-100 trust score computed by TrustAgent
 * - verdict: TRUSTWORTHY / CAUTIOUS / SUSPICIOUS / UNRELIABLE
 * - reportHash: keccak256 hash of the full analysis report JSON
 */

const { SchemaRegistry } = require("@ethereum-attestation-service/eas-sdk");
const { ethers } = require("ethers");
require("dotenv").config();

const SCHEMA_REGISTRY_ADDRESS = "0x4200000000000000000000000000000000000020";
const VALIDATION_SCHEMA = "uint256 agentId, uint8 trustScore, string verdict, string reportHash";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("");
  console.log("=== TrustAgent Validation Schema Registration ===");
  console.log("");
  console.log("  Wallet:  " + signer.address);

  const balance = await provider.getBalance(signer.address);
  console.log("  Balance: " + ethers.formatEther(balance) + " ETH");

  if (balance === 0n) {
    console.log("  ERROR: No ETH! Get testnet ETH from https://www.superchain.tools/faucet");
    process.exit(1);
  }

  const schemaRegistry = new SchemaRegistry(SCHEMA_REGISTRY_ADDRESS);
  schemaRegistry.connect(signer);

  console.log("");
  console.log("  Schema: " + VALIDATION_SCHEMA);
  console.log("  Registering...");

  const transaction = await schemaRegistry.register({
    schema: VALIDATION_SCHEMA,
    resolverAddress: "0x0000000000000000000000000000000000000000",
    revocable: true,
  });

  const schemaUID = await transaction.wait();

  console.log("");
  console.log("  === SCHEMA REGISTERED ===");
  console.log("");
  console.log("  Schema UID: " + schemaUID);
  console.log("");
  console.log("  Add to your .env file:");
  console.log("    SCHEMA_UID_VALIDATION=" + schemaUID);
  console.log("");
}

main().catch((error) => {
  console.error("Error:", error.message || error);
  process.exit(1);
});
