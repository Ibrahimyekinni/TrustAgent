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
 * COMMANDS (exact syntax or natural language):
 *   review <address> <project> <rating> <review>  -- Create an attestation
 *   check <attestationUID>                         -- Read a single attestation
 *   reputation <address>                           -- See ALL reviews for a freelancer
 *   revoke <attestationUID>                        -- Revoke a review you created
 *   help                                           -- Show available commands
 *   exit                                           -- Quit the agent
 *
 * NATURAL LANGUAGE EXAMPLES:
 *   "leave a 5 star review for 0x1234... on Logo Design, amazing work"
 *   "show me the reputation for 0x1234..."
 *   "how is 0x1234... rated?"
 *   "revoke review 0xabc123..."
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

// Our schemas -- V1 and V2
const SCHEMA_STRING_V1 = "address freelancer, string projectName, uint8 rating, string review";
const SCHEMA_STRING_V2 = "address freelancer, string projectName, uint8 rating, string review, string proofURI";

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
async function createReview(freelancerAddress, projectName, rating, reviewText, proofURI) {
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

  const proof = proofURI || "";

  console.log("");
  console.log("  Creating on-chain review...");
  console.log("  Freelancer: " + freelancerAddress);
  console.log("  Project:    " + projectName);
  console.log("  Rating:     " + ratingNum + " / 5");
  console.log("  Review:     " + reviewText);
  if (proof) console.log("  Proof:      " + proof);
  console.log("");

  // Use V2 schema (with proofURI field)
  const schemaUID = process.env.SCHEMA_UID_V2 || process.env.SCHEMA_UID;
  const schemaString = process.env.SCHEMA_UID_V2 ? SCHEMA_STRING_V2 : SCHEMA_STRING_V1;

  const schemaEncoder = new SchemaEncoder(schemaString);
  const encodeFields = [
    { name: "freelancer", value: freelancerAddress, type: "address" },
    { name: "projectName", value: projectName, type: "string" },
    { name: "rating", value: ratingNum, type: "uint8" },
    { name: "review", value: reviewText, type: "string" },
  ];
  if (process.env.SCHEMA_UID_V2) {
    encodeFields.push({ name: "proofURI", value: proof, type: "string" });
  }
  const encodedData = schemaEncoder.encodeData(encodeFields);

  console.log("  Sending transaction to Base Sepolia...");

  const transaction = await eas.attest({
    schema: schemaUID,
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

  // Query both V1 and V2 schemas to get all reviews
  const query = `
    query GetAttestations($where: AttestationWhereInput) {
      attestations(where: $where, orderBy: [{ time: desc }]) {
        id
        attester
        recipient
        time
        revocationTime
        schemaId
        data
      }
    }
  `;

  // Fetch V1 and V2 reviews in parallel
  const [v1Response, v2Response] = await Promise.all([
    fetch(EAS_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { where: { schemaId: { equals: process.env.SCHEMA_UID }, recipient: { equals: freelancerAddress } } } }),
    }),
    process.env.SCHEMA_UID_V2 ? fetch(EAS_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { where: { schemaId: { equals: process.env.SCHEMA_UID_V2 }, recipient: { equals: freelancerAddress } } } }),
    }) : Promise.resolve({ json: () => ({ data: { attestations: [] } }) }),
  ]);

  const [v1Result, v2Result] = await Promise.all([v1Response.json(), v2Response.json()]);

  if (v1Result.errors) {
    console.log("  Error querying EAS: " + v1Result.errors[0].message);
    return;
  }

  // Combine and sort by time descending
  const attestations = [
    ...v1Result.data.attestations,
    ...(v2Result.data ? v2Result.data.attestations : []),
  ].sort((a, b) => Number(b.time) - Number(a.time));

  if (attestations.length === 0) {
    console.log("");
    console.log("  No reviews found for this address.");
    console.log("  Either this freelancer hasn't been reviewed yet,");
    console.log("  or the address is wrong.");
    console.log("");
    return;
  }

  // Decode each attestation and collect the data
  const schemaEncoderV1 = new SchemaEncoder(SCHEMA_STRING_V1);
  const schemaEncoderV2 = process.env.SCHEMA_UID_V2 ? new SchemaEncoder(SCHEMA_STRING_V2) : null;
  const reviews = [];
  let totalRating = 0;
  let activeCount = 0;

  for (const att of attestations) {
    const isV2 = att.schemaId === process.env.SCHEMA_UID_V2;
    const encoder = isV2 && schemaEncoderV2 ? schemaEncoderV2 : schemaEncoderV1;
    const decoded = encoder.decodeData(att.data);
    const rating = Number(decoded[2].value.value);
    const isRevoked = Number(att.revocationTime) > 0;
    const proofURI = isV2 && decoded[4] ? decoded[4].value.value : "";

    reviews.push({
      projectName: decoded[1].value.value,
      rating: rating,
      reviewText: decoded[3].value.value,
      proofURI: proofURI,
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
    if (r.proofURI) console.log("  ║     Proof: " + r.proofURI);
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
  console.log("  ┌─── TrustAgent Commands ─────────────────────────────────");
  console.log("  │");
  console.log("  │  You can use exact commands OR just type naturally.");
  console.log("  │");
  console.log("  │  LEAVE A REVIEW");
  console.log('  │    review 0x1234... "Logo Design" 5 "Fast delivery"');
  console.log("  │    or: leave a 5 star review for 0x1234... on Logo Design, fast delivery");
  console.log("  │    or: give 0x1234... a 4 star rating on Website Build, solid work");
  console.log("  │");
  console.log("  │  CHECK REPUTATION");
  console.log("  │    reputation 0x1234...");
  console.log("  │    or: show me the reputation for 0x1234...");
  console.log("  │    or: how is 0x1234... rated?");
  console.log("  │");
  console.log("  │  LOOK UP A REVIEW");
  console.log("  │    check 0xabc123...");
  console.log("  │    or: look up attestation 0xabc123...");
  console.log("  │");
  console.log("  │  REVOKE A REVIEW");
  console.log("  │    revoke 0xabc123...");
  console.log("  │    or: revoke review 0xabc123...");
  console.log("  │    or: take back 0xabc123...");
  console.log("  │");
  console.log("  │  OTHER");
  console.log("  │    help    -- Show this message");
  console.log("  │    exit    -- Quit TrustAgent");
  console.log("  │");
  console.log("  └─────────────────────────────────────────────────────────");
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
 * Natural Language Parser
 *
 * WHAT THIS DOES:
 * Takes plain English input and figures out which command the user wants,
 * plus extracts the parameters they provided. This lets users type things like
 * "give 0x1234 a 5 star review on Logo Design, amazing work" instead of
 * memorizing exact command syntax.
 *
 * HOW IT WORKS:
 * 1. Extract any 0x addresses from the input (wallet or attestation IDs)
 * 2. Look for keyword patterns that signal which command the user wants
 * 3. For review commands, extract the rating, project name, and review text
 * 4. Return a structured command object that the main loop can execute
 *
 * RETURNS:
 * { command: "review"|"check"|"reputation"|"revoke"|"help"|"exit", args: [...] }
 * or null if it can't figure out what the user wants
 *
 * NOTE (V2): This uses keyword matching. A future version could use Claude API
 * for true natural language understanding -- see BACKLOG.md.
 */
function parseNaturalLanguage(input) {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Extract all 0x addresses from the input
  // Wallet addresses are 42 chars (0x + 40 hex), attestation UIDs are 66 chars (0x + 64 hex)
  const addressPattern = /0x[a-fA-F0-9]{40,64}/gi;
  const addresses = input.match(addressPattern) || [];

  // --- HELP ---
  if (/^(help|commands|what can you do|how do|how does|what do)/i.test(trimmed)) {
    return { command: "help", args: [] };
  }

  // --- EXIT ---
  // "leave" alone means exit, but "leave a review" means review -- so exclude "leave a/the"
  if (/^(exit|quit|bye|goodbye|close|stop)\b/i.test(trimmed) ||
      /^leave\b/i.test(trimmed) && !/^leave\s+(a|the|an)\b/i.test(trimmed)) {
    return { command: "exit", args: [] };
  }

  // --- REVOKE ---
  // Keywords: revoke, take back, remove, undo, cancel, delete
  if (/^revoke\b/i.test(trimmed) ||
      /\b(revoke|take\s*back|undo|cancel)\b/i.test(trimmed) && addresses.length > 0 ||
      /\b(remove|delete)\b/i.test(trimmed) && /\b(review|attestation|rating)\b/i.test(trimmed)) {
    if (addresses.length === 0) {
      return { command: "error", message: "I need the attestation ID to revoke. It starts with 0x and is 66 characters long." };
    }
    // Use the longest address (attestation UIDs are longer than wallet addresses)
    const uid = addresses.sort((a, b) => b.length - a.length)[0];
    return { command: "revoke", args: [uid] };
  }

  // --- REVIEW ---
  // Keywords: review, rate, leave, give, write, submit, post + review/rating/stars/feedback
  const isReviewIntent =
    /\b(leave|give|write|submit|post|create|add)\b.*\b(review|rating|feedback|stars?)\b/i.test(trimmed) ||
    /\b(rate|review)\b.*\b(for|on)\b/i.test(trimmed) ||
    /\b\d\s*stars?\b/i.test(trimmed) && addresses.length > 0;

  if (isReviewIntent && addresses.length > 0) {
    // Find the wallet address (42 chars, not 66)
    const walletAddress = addresses.find(a => a.length === 42) || addresses[0];

    // Extract rating (1-5)
    const ratingMatch = input.match(/\b([1-5])\s*(?:\/\s*5|stars?|out of 5)?/i) ||
                        input.match(/\brating\s*(?:of\s*)?([1-5])/i);
    if (!ratingMatch) {
      return { command: "error", message: "I need a rating between 1 and 5. Try something like '5 stars' or 'rating 4'." };
    }
    const rating = ratingMatch[1];

    // Extract project name -- look for common patterns
    // "on <project>", "for <project>", "project <name>"
    const originalInput = input;
    let projectName = null;

    // Pattern: quoted project name anywhere (highest priority -- user was explicit)
    const quotedParts = originalInput.match(/"([^"]+)"/g);
    if (quotedParts && quotedParts.length >= 1) {
      projectName = quotedParts[0].replace(/"/g, "");
    }

    // Pattern: "on the <project name>," or "on <project name>,"
    // Captures everything between "on (the)" and the next comma, period, or dash-space
    if (!projectName) {
      const onMatch = originalInput.match(/\bon\s+(?:the\s+)?(?:project\s+)?([^,.\-"]+?)(?:\s*,|\s*\.|\s*-\s|\s*$)/i);
      if (onMatch) {
        let name = onMatch[1].trim();
        // Remove trailing words that are review text starters
        name = name.replace(/\s+(they|she|he|it|was|is|did)\s*$/i, "").trim();
        if (name && !name.startsWith("0x")) projectName = name;
      }
    }

    // Pattern: "for the <project name>," (but not "for 0x...")
    if (!projectName) {
      const forMatch = originalInput.match(/\bfor\s+(?:the\s+)?(?:project\s+)?([^,.\-"]+?)(?:\s*,|\s*\.|\s*-\s|\s*$)/i);
      if (forMatch) {
        let name = forMatch[1].trim();
        name = name.replace(/\s+(they|she|he|it|was|is|did)\s*$/i, "").trim();
        if (name && !name.startsWith("0x")) projectName = name;
      }
    }

    // Pattern: "project: <name>" or "project name: <name>"
    if (!projectName) {
      const projMatch = originalInput.match(/\bproject\s*(?:name)?[\s:]+["']?([^"',.\-]+?)["']?\s*(?:,|\.|$)/i);
      if (projMatch) projectName = projMatch[1].trim();
    }

    if (!projectName) {
      return { command: "error", message: "I need the project name. Try putting it in quotes like \"Logo Design\" or say 'on the Logo Design project'." };
    }

    // Extract review text -- everything after common separators
    let reviewText = null;

    // Look for review text after separators: comma, dash, "they", "was", "did"
    const reviewSeparators = /(?:,\s*|\.\s*|-\s+)(they\s+|she\s+|he\s+|it\s+|was\s+|did\s+|really\s+|very\s+|absolutely\s+|great\s+|amazing\s+|excellent\s+|good\s+|solid\s+|terrible\s+|bad\s+|poor\s+|[a-z])/i;
    const sepMatch = originalInput.match(reviewSeparators);
    if (sepMatch) {
      const sepIndex = originalInput.indexOf(sepMatch[0]);
      reviewText = originalInput.slice(sepIndex).replace(/^[,.\-\s]+/, "").trim();
    }

    // Pattern: quoted review text (second quoted string)
    if (!reviewText) {
      const quotedParts = originalInput.match(/"([^"]+)"/g);
      if (quotedParts && quotedParts.length >= 2) {
        reviewText = quotedParts[1].replace(/"/g, "");
      }
    }

    if (!reviewText) {
      reviewText = "Great work";  // Default review text
    }

    // Clean up -- capitalize first letter
    reviewText = reviewText.charAt(0).toUpperCase() + reviewText.slice(1);

    return { command: "review", args: [walletAddress, projectName, rating, reviewText] };
  }

  // --- CHECK ---
  // Must come BEFORE reputation so "look up review 0x..." hits check, not reputation
  // Keywords: check, verify, view, inspect + attestation/review + long attestation ID
  const isCheckIntent =
    /\b(check|verify|view|inspect|look\s*up|show|see)\b.*\b(attestation|review)\b/i.test(trimmed) ||
    /\b(attestation|review)\b.*\b(check|verify|view|details)\b/i.test(trimmed);

  if (isCheckIntent && addresses.length > 0) {
    const uid = addresses.sort((a, b) => b.length - a.length)[0];
    return { command: "check", args: [uid] };
  }

  // --- REPUTATION ---
  // Keywords: reputation, rep, profile, reviews for, how is, show, look up + wallet address
  const isRepIntent =
    /\b(reputation|rep|profile|rating|reviews?)\b.*\b(for|of|on)\b/i.test(trimmed) ||
    /\b(show|look\s*up|check|get|find|see|view)\b.*\b(reputation|rep|profile|reviews?|rating)\b/i.test(trimmed) ||
    /\bhow\s+is\b.*\brated\b/i.test(trimmed) ||
    /\bwhat('s|\s+is)\s+(the\s+)?(rep|reputation|rating)\b/i.test(trimmed) ||
    /\b(show|look\s*up|check)\b.*0x/i.test(trimmed) && !/\b(attestation|review|revoke)\b/i.test(trimmed);

  if (isRepIntent && addresses.length > 0) {
    const walletAddress = addresses.find(a => a.length === 42) || addresses[0];
    return { command: "reputation", args: [walletAddress] };
  }

  // --- FALLBACK: just an address with no clear intent ---
  // If they just pasted an address, guess based on length
  if (addresses.length > 0 && trimmed.replace(/0x[a-f0-9]+/gi, "").trim().length < 10) {
    const addr = addresses[0];
    if (addr.length === 42) {
      // Wallet address -- probably wants reputation
      return { command: "reputation", args: [addr] };
    } else if (addr.length === 66) {
      // Attestation UID -- probably wants to check it
      return { command: "check", args: [addr] };
    }
  }

  return null;
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
            // Rigid command didn't match -- try natural language parsing
            const nlp = parseNaturalLanguage(input);
            if (nlp && nlp.command === "error") {
              console.log("  " + nlp.message);
            } else if (nlp) {
              console.log("  Got it -- running: " + nlp.command + (nlp.args.length > 0 ? " " + nlp.args[0].slice(0, 10) + "..." : ""));
              console.log("");
              switch (nlp.command) {
                case "review":
                  await createReview(nlp.args[0], nlp.args[1], nlp.args[2], nlp.args[3]);
                  break;
                case "check":
                  await checkReview(nlp.args[0]);
                  break;
                case "reputation":
                  await getReputation(nlp.args[0]);
                  break;
                case "revoke":
                  await revokeReview(nlp.args[0]);
                  break;
                case "help":
                  showHelp();
                  break;
                case "exit":
                  console.log("\n  Shutting down TrustAgent. See you next time.\n");
                  rl.close();
                  process.exit(0);
                  break;
              }
            } else {
              console.log("  I didn't quite get that. Try something like:");
              console.log('    "leave a 5 star review for 0x1234... on Logo Design, great work"');
              console.log('    "show me the reputation for 0x1234..."');
              console.log("  Or type 'help' for all commands.");
            }
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
