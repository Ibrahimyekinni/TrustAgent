/**
 * createAttestation.js
 *
 * NOTE: This is a standalone utility script from Day 1. For normal use,
 * run the CLI agent instead: node agent/trustAgent.js
 *
 * WHAT THIS DOES:
 * Creates an on-chain attestation (review/reputation entry) for a freelancer.
 * Think of it like leaving a review on Fiverr, except:
 * - It lives on the blockchain, not on Fiverr's servers
 * - No platform can delete it
 * - The freelancer can show it to ANYONE, on ANY platform
 *
 * HOW IT WORKS:
 * 1. We connect to EAS on Base Sepolia
 * 2. We encode the review data (freelancer address, project name, rating, review text)
 * 3. We send a transaction to EAS's attest() function
 * 4. EAS stores this permanently on-chain and gives us a unique attestation ID
 *
 * USAGE:
 * node scripts/createAttestation.js <freelancerAddress> <projectName> <rating> <review>
 *
 * Example:
 * node scripts/createAttestation.js 0x1234...abcd "Manychat Bot" 5 "Delivered on time, excellent work"
 */

const { EAS, SchemaEncoder, NO_EXPIRATION } = require("@ethereum-attestation-service/eas-sdk");
const { ethers } = require("ethers");
require("dotenv").config();

// EAS contract address on Base Sepolia (same as Base Mainnet -- it's a predeploy)
const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021";

async function main() {
  // Parse command line arguments
  // process.argv[0] = "node", process.argv[1] = "scripts/createAttestation.js"
  // So our actual arguments start at index 2
  const freelancerAddress = process.argv[2];
  const projectName = process.argv[3];
  const rating = parseInt(process.argv[4]);
  const review = process.argv[5];

  // Validate inputs
  if (!freelancerAddress || !projectName || !rating || !review) {
    console.log("Usage: node scripts/createAttestation.js <freelancerAddress> <projectName> <rating> <review>");
    console.log('Example: node scripts/createAttestation.js 0x1234...abcd "Manychat Bot" 5 "Great work"');
    process.exit(1);
  }

  if (rating < 1 || rating > 5) {
    console.log("ERROR: Rating must be between 1 and 5");
    process.exit(1);
  }

  if (!process.env.SCHEMA_UID) {
    console.log("ERROR: SCHEMA_UID not found in .env file.");
    console.log("Run registerSchema.js first, then add the schema UID to your .env file.");
    process.exit(1);
  }

  // Step 1: Connect to Base Sepolia
  const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("Attester (you):", signer.address);
  console.log("Freelancer:", freelancerAddress);
  console.log("Project:", projectName);
  console.log("Rating:", rating, "/ 5");
  console.log("Review:", review);

  // Step 2: Connect to the EAS contract
  const eas = new EAS(EAS_CONTRACT_ADDRESS);
  eas.connect(signer);

  // Step 3: Encode the attestation data
  // The SchemaEncoder takes our schema definition and encodes the actual values
  // into bytes that the blockchain can store. It's like packing the form data
  // into a format the smart contract understands.
  const schemaEncoder = new SchemaEncoder("address freelancer, string projectName, uint8 rating, string review");
  const encodedData = schemaEncoder.encodeData([
    { name: "freelancer", value: freelancerAddress, type: "address" },
    { name: "projectName", value: projectName, type: "string" },
    { name: "rating", value: rating, type: "uint8" },
    { name: "review", value: review, type: "string" },
  ]);

  // Step 4: Create the attestation
  // - schema: which "form template" to use (our schema UID)
  // - recipient: who this attestation is about (the freelancer)
  // - expirationTime: when does it expire? NO_EXPIRATION = lasts forever
  // - revocable: can the attester take it back? Yes, in case of disputes
  // - data: the encoded form data from Step 3
  console.log("\nCreating attestation on-chain...");
  console.log("This may take a minute (waiting for transaction confirmation)...\n");

  const transaction = await eas.attest({
    schema: process.env.SCHEMA_UID,
    data: {
      recipient: freelancerAddress,
      expirationTime: NO_EXPIRATION,
      revocable: true,
      data: encodedData,
    },
  });

  const attestationUID = await transaction.wait();

  console.log("Attestation created successfully!");
  console.log("Attestation UID:", attestationUID);
  console.log("\nView on EAS Explorer: https://base-sepolia.easscan.org/attestation/view/" + attestationUID);
}

main().catch((error) => {
  console.error("Error:", error.message || error);
  process.exit(1);
});
