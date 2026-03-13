/**
 * registerSchema.js
 *
 * WHAT THIS DOES:
 * Registers a "form template" (schema) on EAS (Ethereum Attestation Service).
 * Think of it like designing a review form -- we're telling EAS:
 * "Hey, our attestations will have these fields: freelancer name, project name,
 * rating, and a review comment."
 *
 * Once registered, this schema gets a unique ID (schemaUID) that we use every time
 * we create a new attestation. You only need to run this ONCE.
 *
 * WHY EAS AND NOT A CUSTOM CONTRACT:
 * EAS is already deployed on Base. We don't need to write or deploy our own smart
 * contract -- we just talk to EAS's existing contracts. This saves us time and is
 * exactly what the hackathon judges want to see ("use what already exists").
 */

const { SchemaRegistry } = require("@ethereum-attestation-service/eas-sdk");
const { ethers } = require("ethers");
require("dotenv").config();

// EAS SchemaRegistry contract address on Base Sepolia
// This is the same address on both Base Sepolia (testnet) and Base Mainnet
// It's a "predeploy" -- Base baked it in at this address from the start
const SCHEMA_REGISTRY_ADDRESS = "0x4200000000000000000000000000000000000020";

// Our schema definition -- these are the fields in our "review form"
// Each field has a type and a name, separated by commas
//
// - address freelancer: the wallet address of the freelancer being reviewed
// - string projectName: what project was completed (e.g., "Manychat bot for pizza shop")
// - uint8 rating: score from 1-5 (uint8 = number from 0-255, but we'll enforce 1-5 in our code)
// - string review: written feedback (e.g., "Great work, delivered on time")
const SCHEMA = "address freelancer, string projectName, uint8 rating, string review";

async function main() {
  // Step 1: Connect to Base Sepolia using our wallet
  // The provider is like a phone line to the blockchain
  // The signer is our identity -- proves we are who we say we are (using our private key)
  const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("Connected wallet:", signer.address);

  // Check our balance to make sure we have testnet ETH for gas fees
  const balance = await provider.getBalance(signer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    console.log("ERROR: No ETH in wallet! Get testnet ETH from https://www.superchain.tools/faucet");
    process.exit(1);
  }

  // Step 2: Connect to the SchemaRegistry contract
  // This is EAS's contract that stores all schema definitions
  const schemaRegistry = new SchemaRegistry(SCHEMA_REGISTRY_ADDRESS);
  schemaRegistry.connect(signer);

  // Step 3: Register our schema
  // - schema: our field definitions
  // - resolverAddress: optional smart contract that runs extra logic on each attestation
  //   We don't need one, so we use the zero address (0x000...000)
  // - revocable: can attestations using this schema be revoked (taken back)?
  //   Yes -- because a client might want to revoke a review if there's a dispute
  console.log("\nRegistering schema:", SCHEMA);
  console.log("This may take a minute (waiting for the transaction to be confirmed on-chain)...\n");

  const transaction = await schemaRegistry.register({
    schema: SCHEMA,
    resolverAddress: "0x0000000000000000000000000000000000000000",
    revocable: true,
  });

  // Wait for the transaction to be mined (confirmed by the network)
  const schemaUID = await transaction.wait();

  console.log("Schema registered successfully!");
  console.log("Schema UID:", schemaUID);
  console.log("\nSAVE THIS UID -- you need it to create attestations.");
  console.log("Add it to your .env file as: SCHEMA_UID=" + schemaUID);
}

main().catch((error) => {
  console.error("Error:", error.message || error);
  process.exit(1);
});
