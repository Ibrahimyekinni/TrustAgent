/**
 * registerSchemaV2.js
 *
 * Registers the V2 schema with proof-of-work field.
 * V1: address freelancer, string projectName, uint8 rating, string review
 * V2: address freelancer, string projectName, uint8 rating, string review, string proofURI
 *
 * The proofURI field lets reviewers attach a link to evidence that work was done
 * (invoice, GitHub commit, Google Drive link, etc.)
 */

const { SchemaRegistry } = require("@ethereum-attestation-service/eas-sdk");
const { ethers } = require("ethers");
require("dotenv").config();

const SCHEMA_REGISTRY_ADDRESS = "0x4200000000000000000000000000000000000020";
const SCHEMA_V2 = "address freelancer, string projectName, uint8 rating, string review, string proofURI";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("Connected wallet:", signer.address);

  const balance = await provider.getBalance(signer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    console.log("ERROR: No ETH in wallet! Get testnet ETH from https://www.superchain.tools/faucet");
    process.exit(1);
  }

  const schemaRegistry = new SchemaRegistry(SCHEMA_REGISTRY_ADDRESS);
  schemaRegistry.connect(signer);

  console.log("\nRegistering V2 schema:", SCHEMA_V2);
  console.log("This may take a minute...\n");

  const transaction = await schemaRegistry.register({
    schema: SCHEMA_V2,
    resolverAddress: "0x0000000000000000000000000000000000000000",
    revocable: true,
  });

  const schemaUID = await transaction.wait();

  console.log("V2 Schema registered successfully!");
  console.log("Schema UID:", schemaUID);
  console.log("\nUpdate your .env file:");
  console.log("  SCHEMA_UID_V2=" + schemaUID);
  console.log("\nKeep SCHEMA_UID (V1) for reading old attestations.");
}

main().catch((error) => {
  console.error("Error:", error.message || error);
  process.exit(1);
});
