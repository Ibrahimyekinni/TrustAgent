/**
 * getAttestation.js
 *
 * WHAT THIS DOES:
 * Reads an attestation from the blockchain and displays it in a readable format.
 * This is the "verification" step -- anyone can run this to check if a freelancer's
 * reputation claim is real.
 *
 * Think of it like checking a freelancer's Fiverr reviews, except:
 * - You don't need a Fiverr account
 * - The reviews can't be faked or deleted by any platform
 * - You just need the attestation ID
 *
 * USAGE:
 * node scripts/getAttestation.js <attestationUID>
 */

const { EAS, SchemaEncoder } = require("@ethereum-attestation-service/eas-sdk");
const { ethers } = require("ethers");
require("dotenv").config();

const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021";

async function main() {
  const attestationUID = process.argv[2];

  if (!attestationUID) {
    console.log("Usage: node scripts/getAttestation.js <attestationUID>");
    console.log("Example: node scripts/getAttestation.js 0xabc123...");
    process.exit(1);
  }

  // Step 1: Connect to Base Sepolia (read-only -- no signer needed)
  // We only need a provider here because we're just reading data, not writing.
  // Reading from the blockchain is free -- no gas fees.
  const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);

  const eas = new EAS(EAS_CONTRACT_ADDRESS);
  eas.connect(provider);

  // Step 2: Fetch the attestation from the blockchain
  console.log("Fetching attestation:", attestationUID);
  console.log("");

  const attestation = await eas.getAttestation(attestationUID);

  // Step 3: Decode the data
  // The raw attestation stores data as bytes (machine-readable).
  // We use SchemaEncoder to decode it back into human-readable fields.
  const schemaEncoder = new SchemaEncoder("address freelancer, string projectName, uint8 rating, string review");
  const decodedData = schemaEncoder.decodeData(attestation.data);

  // Step 4: Display the results
  // decodedData is an array of objects, each with { name, value, type }
  const freelancer = decodedData[0].value.value;
  const projectName = decodedData[1].value.value;
  const rating = decodedData[2].value.value;
  const review = decodedData[3].value.value;

  console.log("=== ATTESTATION DETAILS ===");
  console.log("");
  console.log("Attestation ID:", attestationUID);
  console.log("Schema:", attestation.schema);
  console.log("");
  console.log("--- Review ---");
  console.log("Freelancer:", freelancer);
  console.log("Project:", projectName);
  console.log("Rating:", Number(rating), "/ 5");
  console.log("Review:", review);
  console.log("");
  console.log("--- Metadata ---");
  console.log("Attester (reviewer):", attestation.attester);
  console.log("Recipient:", attestation.recipient);
  console.log("Created:", new Date(Number(attestation.time) * 1000).toISOString());
  console.log("Revocable:", attestation.revocable);
  console.log("Revoked:", attestation.revocationTime > 0 ? "YES" : "No");
  console.log("");
  console.log("View on EAS Explorer: https://base-sepolia.easscan.org/attestation/view/" + attestationUID);
}

main().catch((error) => {
  console.error("Error:", error.message || error);
  process.exit(1);
});
