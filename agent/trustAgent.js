/**
 * trustAgent.js -- The TrustAgent CLI
 *
 * WHAT THIS IS:
 * A command-line agent that lets you interact with TrustAgent using simple commands
 * instead of typing raw blockchain stuff. This is the "brain" of TrustAgent.
 *
 * WHY WE NEED THIS:
 * The hackathon judges want to see "meaningful agent contribution" -- the agent
 * can't just be a wrapper. This agent:
 * 1. Takes simple commands from the user
 * 2. Handles all the blockchain complexity behind the scenes
 * 3. Creates and reads attestations without the user needing to know Solidity or EAS
 *
 * COMMANDS:
 *   review <address> <project> <rating> <review>  -- Create an attestation
 *   check <attestationUID>                         -- Read a single attestation
 *   reputation <address>                           -- See ALL reviews for a freelancer
 *   revoke <attestationUID>                        -- Revoke a review you created
 *   help                                           -- Show available commands
 *   exit                                           -- Quit the agent
 *
 * HOW TO RUN:
 *   node agent/trustAgent.js
 */

const { EAS, SchemaEncoder, NO_EXPIRATION } = require("@ethereum-attestation-service/eas-sdk");
const { ethers } = require("ethers");
const readline = require("readline");
require("dotenv").config();

// Contract addresses on Base Sepolia (these are the same on Base Mainnet too)
const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021";

// Our schema -- the "review form" fields
const SCHEMA_STRING = "address freelancer, string projectName, uint8 rating, string review";

// EAS GraphQL API -- this is a search engine for attestations.
// Instead of looking up one attestation at a time by UID, we can search
// for ALL attestations that match certain criteria (like "all reviews for this freelancer").
const EAS_GRAPHQL_URL = "https://base-sepolia.easscan.org/graphql";

// Global variables for the agent's blockchain connection
let eas;
let signer;
let provider;

/**
 * Initialize the agent's connection to the blockchain.
 * This runs once when the agent starts up.
 */
async function initialize() {
  // Validate that we have everything we need
  if (!process.env.PRIVATE_KEY) {
    console.log("ERROR: PRIVATE_KEY not found in .env file");
    process.exit(1);
  }
  if (!process.env.SCHEMA_UID) {
    console.log("ERROR: SCHEMA_UID not found in .env file");
    console.log("Run 'node scripts/registerSchema.js' first.");
    process.exit(1);
  }

  // Connect to Base Sepolia
  provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
  signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // Connect to EAS
  eas = new EAS(EAS_CONTRACT_ADDRESS);
  eas.connect(signer);

  // Check balance
  const balance = await provider.getBalance(signer.address);

  console.log("");
  console.log("=========================================");
  console.log("  TrustAgent -- On-Chain Reputation Agent");
  console.log("=========================================");
  console.log("");
  console.log("  Wallet:  " + signer.address);
  console.log("  Balance: " + ethers.formatEther(balance) + " ETH");
  console.log("  Network: Base Sepolia (testnet)");
  console.log("  Schema:  " + process.env.SCHEMA_UID.slice(0, 10) + "...");
  console.log("");
  console.log("  Type 'help' to see available commands.");
  console.log("");
}

/**
 * Create a review (attestation) on-chain.
 *
 * This is what happens when you type:
 *   review 0x1234... "My Project" 5 "Great work"
 *
 * The agent takes those inputs, encodes them into the format EAS expects,
 * sends a transaction to the blockchain, and waits for confirmation.
 */
async function createReview(freelancerAddress, projectName, rating, reviewText) {
  // Validate the wallet address format
  if (!ethers.isAddress(freelancerAddress)) {
    console.log("  Invalid wallet address: " + freelancerAddress);
    console.log("  Wallet addresses start with 0x and are 42 characters long.");
    return;
  }

  // Validate rating
  const ratingNum = parseInt(rating);
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    console.log("  Rating must be between 1 and 5.");
    return;
  }

  console.log("");
  console.log("  Creating on-chain review...");
  console.log("  Freelancer: " + freelancerAddress);
  console.log("  Project:    " + projectName);
  console.log("  Rating:     " + ratingNum + " / 5");
  console.log("  Review:     " + reviewText);
  console.log("");

  // Encode the data for the blockchain
  const schemaEncoder = new SchemaEncoder(SCHEMA_STRING);
  const encodedData = schemaEncoder.encodeData([
    { name: "freelancer", value: freelancerAddress, type: "address" },
    { name: "projectName", value: projectName, type: "string" },
    { name: "rating", value: ratingNum, type: "uint8" },
    { name: "review", value: reviewText, type: "string" },
  ]);

  console.log("  Sending transaction to Base Sepolia...");

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

  console.log("");
  console.log("  Review created successfully!");
  console.log("  Attestation ID: " + attestationUID);
  console.log("  View: https://base-sepolia.easscan.org/attestation/view/" + attestationUID);
  console.log("");
}

/**
 * Read and display an attestation from the blockchain.
 *
 * This is the verification step -- anyone can check if a review is real
 * by providing its attestation ID.
 */
async function checkReview(attestationUID) {
  console.log("");
  console.log("  Fetching attestation from blockchain...");

  const attestation = await eas.getAttestation(attestationUID);

  // Decode the raw bytes back into readable data
  const schemaEncoder = new SchemaEncoder(SCHEMA_STRING);
  const decodedData = schemaEncoder.decodeData(attestation.data);

  const freelancer = decodedData[0].value.value;
  const projectName = decodedData[1].value.value;
  const rating = Number(decodedData[2].value.value);
  const review = decodedData[3].value.value;

  // Display a nice summary
  console.log("");
  console.log("  ┌─── Review Details ───────────────────");
  console.log("  │");
  console.log("  │  Freelancer:  " + freelancer);
  console.log("  │  Project:     " + projectName);
  console.log("  │  Rating:      " + "★".repeat(rating) + "☆".repeat(5 - rating) + " (" + rating + "/5)");
  console.log("  │  Review:      " + review);
  console.log("  │");
  console.log("  │  Reviewer:    " + attestation.attester);
  console.log("  │  Date:        " + new Date(Number(attestation.time) * 1000).toLocaleDateString());
  console.log("  │  Revoked:     " + (attestation.revocationTime > 0 ? "YES" : "No"));
  console.log("  │");
  console.log("  └────────────────────────────────────────");
  console.log("");
}

/**
 * Look up ALL reviews for a freelancer by their wallet address.
 *
 * This is the "Fiverr profile page" equivalent -- instead of checking one
 * review at a time, this shows EVERY review a freelancer has received,
 * plus their average rating.
 *
 * HOW IT WORKS:
 * 1. We send a GraphQL query to the EAS indexer (a search engine for attestations)
 * 2. The query says: "Give me all attestations where the recipient is this address
 *    AND the schema matches our review schema"
 * 3. We decode each attestation's data and display it
 * 4. We calculate the average rating across all reviews
 *
 * WHY GRAPHQL?
 * The EAS smart contract on-chain doesn't support searching -- you can only
 * look up one attestation if you already know its UID. The EAS team runs a
 * separate indexer service that watches the blockchain and builds a searchable
 * database. GraphQL is the language we use to query that database.
 */
async function getReputation(freelancerAddress) {
  if (!ethers.isAddress(freelancerAddress)) {
    console.log("  Invalid wallet address: " + freelancerAddress);
    console.log("  Wallet addresses start with 0x and are 42 characters long.");
    return;
  }

  console.log("");
  console.log("  Searching for all reviews for " + freelancerAddress.slice(0, 10) + "...");

  // This is a GraphQL query -- it's like a very specific search request.
  // We're asking: "Find all attestations where:
  //   - the schema matches our review schema (SCHEMA_UID)
  //   - the recipient is this freelancer's address
  //   - order them newest first"
  const query = `
    query GetAttestations($where: AttestationWhereInput) {
      attestations(where: $where, orderBy: [{ time: desc }]) {
        id
        attester
        recipient
        time
        revocationTime
        data
      }
    }
  `;

  const variables = {
    where: {
      schemaId: { equals: process.env.SCHEMA_UID },
      recipient: { equals: freelancerAddress },
    },
  };

  // Send the search request to the EAS GraphQL API
  const response = await fetch(EAS_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  if (result.errors) {
    console.log("  Error querying EAS: " + result.errors[0].message);
    return;
  }

  const attestations = result.data.attestations;

  if (attestations.length === 0) {
    console.log("");
    console.log("  No reviews found for this address.");
    console.log("  Either this freelancer hasn't been reviewed yet,");
    console.log("  or the address is wrong.");
    console.log("");
    return;
  }

  // Decode each attestation and collect the data
  const schemaEncoder = new SchemaEncoder(SCHEMA_STRING);
  const reviews = [];
  let totalRating = 0;
  let activeCount = 0;

  for (const att of attestations) {
    const decoded = schemaEncoder.decodeData(att.data);
    const rating = Number(decoded[2].value.value);
    const isRevoked = Number(att.revocationTime) > 0;

    reviews.push({
      projectName: decoded[1].value.value,
      rating: rating,
      reviewText: decoded[3].value.value,
      reviewer: att.attester,
      date: new Date(Number(att.time) * 1000).toLocaleDateString(),
      revoked: isRevoked,
      uid: att.id,
    });

    // Only count non-revoked reviews in the average
    if (!isRevoked) {
      totalRating += rating;
      activeCount++;
    }
  }

  const avgRating = activeCount > 0 ? (totalRating / activeCount).toFixed(1) : "N/A";
  const avgStars = activeCount > 0 ? Math.round(totalRating / activeCount) : 0;

  // Display the reputation summary
  console.log("");
  console.log("  ╔═══ Reputation Report ═══════════════════");
  console.log("  ║");
  console.log("  ║  Freelancer:  " + freelancerAddress);
  console.log("  ║  Reviews:     " + activeCount + " active" + (reviews.length > activeCount ? ", " + (reviews.length - activeCount) + " revoked" : ""));
  console.log("  ║  Avg Rating:  " + "★".repeat(avgStars) + "☆".repeat(5 - avgStars) + " (" + avgRating + "/5)");
  console.log("  ║");
  console.log("  ╠═══ Individual Reviews ══════════════════");

  for (let i = 0; i < reviews.length; i++) {
    const r = reviews[i];
    const status = r.revoked ? " [REVOKED]" : "";
    console.log("  ║");
    console.log("  ║  " + (i + 1) + ". " + r.projectName + status);
    console.log("  ║     " + "★".repeat(r.rating) + "☆".repeat(5 - r.rating) + " (" + r.rating + "/5)");
    console.log("  ║     \"" + r.reviewText + "\"");
    console.log("  ║     By: " + r.reviewer.slice(0, 10) + "...  |  " + r.date);
  }

  console.log("  ║");
  console.log("  ╚════════════════════════════════════════════");
  console.log("");
}

/**
 * Revoke a review that YOU created.
 *
 * WHAT THIS DOES:
 * Marks an attestation as "revoked" on-chain. The data stays on the blockchain
 * (nothing can be deleted), but it gets flagged as revoked. Our reputation
 * command filters revoked reviews out of the average rating.
 *
 * WHO CAN REVOKE:
 * Only the original attester (the person who created the review) can revoke it.
 * EAS enforces this at the smart contract level -- if someone else tries to
 * revoke your review, the transaction will fail.
 *
 * WHY THIS MATTERS:
 * - Client changed their mind about a review
 * - Review was posted by mistake
 * - Dispute was resolved and the bad review should no longer count
 *
 * NOTE: This costs gas (ETH) because it's a write operation on the blockchain.
 */
async function revokeReview(attestationUID) {
  console.log("");
  console.log("  Revoking attestation: " + attestationUID.slice(0, 10) + "...");
  console.log("");

  // First, fetch the attestation to confirm it exists and show what we're revoking
  const attestation = await eas.getAttestation(attestationUID);

  // Check if it's already revoked
  if (Number(attestation.revocationTime) > 0) {
    console.log("  This review has already been revoked.");
    console.log("");
    return;
  }

  // Check if the current wallet is the one that created this review
  if (attestation.attester.toLowerCase() !== signer.address.toLowerCase()) {
    console.log("  You can only revoke reviews that YOU created.");
    console.log("  This review was created by: " + attestation.attester);
    console.log("  Your wallet is:             " + signer.address);
    console.log("");
    return;
  }

  // Decode and show what's being revoked
  const schemaEncoder = new SchemaEncoder(SCHEMA_STRING);
  const decoded = schemaEncoder.decodeData(attestation.data);
  const projectName = decoded[1].value.value;
  const rating = Number(decoded[2].value.value);

  console.log("  Revoking review for: " + projectName + " (" + rating + "/5)");
  console.log("  Sending revocation transaction...");

  const transaction = await eas.revoke({
    schema: process.env.SCHEMA_UID,
    data: { uid: attestationUID },
  });

  await transaction.wait();

  console.log("");
  console.log("  Review revoked successfully!");
  console.log("  The review data stays on-chain but is now marked as revoked.");
  console.log("  It will no longer count toward the freelancer's average rating.");
  console.log("");
}

/**
 * Show help text -- lists all available commands.
 */
function showHelp() {
  console.log("");
  console.log("  Available commands:");
  console.log("");
  console.log("  review <address> <project> <rating> <review>");
  console.log("    Create an on-chain review for a freelancer.");
  console.log('    Example: review 0x1234...abcd "Logo Design" 5 "Fast delivery, loved it"');
  console.log("");
  console.log("  reputation <address>");
  console.log("    See ALL reviews and average rating for a freelancer.");
  console.log("    Example: reputation 0x1234...abcd");
  console.log("");
  console.log("  check <attestationUID>");
  console.log("    Look up a single review by its attestation ID.");
  console.log("    Example: check 0xabc123...");
  console.log("");
  console.log("  revoke <attestationUID>");
  console.log("    Revoke a review you created (only works on your own reviews).");
  console.log("    Example: revoke 0xabc123...");
  console.log("");
  console.log("  help");
  console.log("    Show this help message.");
  console.log("");
  console.log("  exit");
  console.log("    Quit TrustAgent.");
  console.log("");
}

/**
 * Parse user input and figure out what command they want.
 *
 * This is a simple parser -- it splits the input into parts and matches
 * the first word to a command. For the "review" command, it handles
 * quoted strings so project names and reviews can have spaces.
 */
function parseInput(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Extract quoted strings first, then split the rest
  const parts = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === " " && !inQuotes) {
      if (current) {
        parts.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);

  return parts;
}

/**
 * Main loop -- keeps asking for input until the user types "exit".
 *
 * This is the agent's "conversation loop." It reads what you type,
 * figures out what you want, and does it.
 */
async function main() {
  await initialize();

  let closed = false;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on("close", () => {
    closed = true;
  });

  const prompt = () => {
    if (closed) return;
    rl.question("  trustagent> ", async (input) => {
      const parts = parseInput(input);

      if (!parts || parts.length === 0) {
        prompt();
        return;
      }

      const command = parts[0].toLowerCase();

      try {
        switch (command) {
          case "review":
            if (parts.length < 5) {
              console.log('  Usage: review <address> <project> <rating> <review>');
              console.log('  Example: review 0x1234... "My Project" 5 "Great work"');
            } else {
              await createReview(parts[1], parts[2], parts[3], parts[4]);
            }
            break;

          case "check":
            if (parts.length < 2) {
              console.log("  Usage: check <attestationUID>");
            } else {
              await checkReview(parts[1]);
            }
            break;

          case "reputation":
          case "rep":
            if (parts.length < 2) {
              console.log("  Usage: reputation <freelancerAddress>");
              console.log("  Example: reputation 0x1234...abcd");
            } else {
              await getReputation(parts[1]);
            }
            break;

          case "revoke":
            if (parts.length < 2) {
              console.log("  Usage: revoke <attestationUID>");
            } else {
              await revokeReview(parts[1]);
            }
            break;

          case "help":
            showHelp();
            break;

          case "exit":
          case "quit":
            console.log("\n  Shutting down TrustAgent. See you next time.\n");
            rl.close();
            process.exit(0);
            break;

          default:
            console.log("  Unknown command: " + command);
            console.log("  Type 'help' to see available commands.");
            break;
        }
      } catch (error) {
        console.log("  Error: " + (error.message || error));
      }

      prompt();
    });
  };

  prompt();
}

main().catch((error) => {
  console.error("Error:", error.message || error);
  process.exit(1);
});
