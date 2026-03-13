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
  console.log("  check <attestationUID>");
  console.log("    Look up a review by its attestation ID.");
  console.log("    Example: check 0xabc123...");
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
