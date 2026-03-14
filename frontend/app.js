/**
 * app.js -- TrustAgent Frontend
 *
 * WHAT THIS DOES:
 * This is the brain of the web page. When someone pastes a wallet address
 * and clicks "Search", this code:
 * 1. Sends a GraphQL query to the EAS indexer (same API our CLI uses)
 * 2. Decodes the attestation data from raw bytes into readable fields
 * 3. Calculates the average rating
 * 4. Renders everything as nice HTML cards
 *
 * NO BACKEND NEEDED:
 * This talks directly to the EAS GraphQL API from the browser.
 * No server, no database, no API keys. The blockchain IS the database.
 */

// Same constants as our CLI agent -- keeping everything consistent
const EAS_GRAPHQL_URL = "https://base-sepolia.easscan.org/graphql";
const SCHEMA_UID = "0x5d6661abb66715bfc01d1744f52f52594c1b01ed473d9facb2825988ef70ce30";

// The schema fields in order -- we need this to decode the raw attestation data
const SCHEMA_FIELDS = ["address", "string", "uint8", "string"];
const FIELD_NAMES = ["freelancer", "projectName", "rating", "review"];

/**
 * Decode raw EAS attestation data (hex bytes) into readable values.
 *
 * WHY WE NEED THIS:
 * Attestation data is stored on-chain as ABI-encoded bytes (a long hex string).
 * The EAS SDK has a SchemaEncoder that does this in Node.js, but in the browser
 * we don't want to import the entire SDK. So we decode it manually using
 * the same ABI decoding logic.
 *
 * ABI encoding puts each value in a 32-byte (64 hex chars) slot. Dynamic types
 * (strings) are stored as pointers to their data at the end of the payload.
 */
function decodeAttestationData(hexData) {
  // Remove '0x' prefix
  const data = hexData.startsWith("0x") ? hexData.slice(2) : hexData;

  // Each ABI slot is 32 bytes = 64 hex characters
  const SLOT = 64;

  // Read a 32-byte slot as a hex string
  const readSlot = (index) => data.slice(index * SLOT, (index + 1) * SLOT);

  // Slot 0: address (last 20 bytes of a 32-byte slot)
  const freelancer = "0x" + readSlot(0).slice(-40);

  // Slot 1: offset to projectName string data
  const projectNameOffset = parseInt(readSlot(1), 16) * 2; // convert byte offset to hex char offset
  // Slot 2: rating (uint8, stored in a full 32-byte slot)
  const rating = parseInt(readSlot(2), 16);

  // Slot 3: offset to review string data
  const reviewOffset = parseInt(readSlot(3), 16) * 2;

  // Read a dynamic string: first 32 bytes = length, then the string bytes
  const readString = (charOffset) => {
    const lengthHex = data.slice(charOffset, charOffset + SLOT);
    const length = parseInt(lengthHex, 16);
    const stringHex = data.slice(charOffset + SLOT, charOffset + SLOT + length * 2);
    // Convert hex to UTF-8 string
    let str = "";
    for (let i = 0; i < stringHex.length; i += 2) {
      str += String.fromCharCode(parseInt(stringHex.slice(i, i + 2), 16));
    }
    return str;
  };

  const projectName = readString(projectNameOffset);
  const review = readString(reviewOffset);

  return { freelancer, projectName, rating, review };
}

/**
 * Validate that a string looks like an Ethereum address.
 * Ethereum addresses are 42 characters: "0x" + 40 hex characters.
 */
function isValidAddress(address) {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Generate star HTML -- filled stars are yellow, empty stars are gray.
 */
function renderStars(rating) {
  let html = "";
  for (let i = 0; i < 5; i++) {
    if (i < rating) {
      html += '<span class="star-filled">&#9733;</span>';
    } else {
      html += '<span class="star-empty">&#9733;</span>';
    }
  }
  return html;
}

/**
 * Generate a deterministic "avatar" from an address.
 * Takes the first 2 non-zero hex chars and uses them as initials-ish display.
 */
function generateAvatar(address) {
  return address.slice(2, 4).toUpperCase();
}

/**
 * Fill the demo address into the search box.
 */
function useDemoAddress() {
  document.getElementById("addressInput").value = "0x12e38f09f8d39Ba1B18Ec2d158cAB0DD92D45eEa";
  lookupReputation();
}

/**
 * Main function -- query EAS and display the reputation report.
 *
 * This is the same logic as getReputation() in our CLI agent,
 * but rendered as HTML instead of console output.
 */
async function lookupReputation() {
  const address = document.getElementById("addressInput").value.trim();

  // Validate
  if (!address) {
    showError("Please enter a wallet address.");
    return;
  }
  if (!isValidAddress(address)) {
    showError("Invalid wallet address. It should start with 0x and be 42 characters long.");
    return;
  }

  // Show loading, hide everything else
  hide("error");
  hide("results");
  hide("noResults");
  hide("demoHint");
  show("loading");

  try {
    // GraphQL query -- same as our CLI agent uses
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
        schemaId: { equals: SCHEMA_UID },
        recipient: { equals: address },
      },
    };

    const response = await fetch(EAS_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();

    if (result.errors) {
      throw new Error(result.errors[0].message);
    }

    const attestations = result.data.attestations;

    hide("loading");

    if (attestations.length === 0) {
      show("noResults");
      return;
    }

    // Decode all attestations
    const reviews = [];
    let totalRating = 0;
    let activeCount = 0;
    let revokedCount = 0;

    for (const att of attestations) {
      const decoded = decodeAttestationData(att.data);
      const isRevoked = parseInt(att.revocationTime) > 0;

      reviews.push({
        projectName: decoded.projectName,
        rating: decoded.rating,
        reviewText: decoded.review,
        reviewer: att.attester,
        date: new Date(parseInt(att.time) * 1000).toLocaleDateString(),
        revoked: isRevoked,
        uid: att.id,
      });

      if (isRevoked) {
        revokedCount++;
      } else {
        totalRating += decoded.rating;
        activeCount++;
      }
    }

    const avgRating = activeCount > 0 ? (totalRating / activeCount).toFixed(1) : "N/A";
    const avgStarsNum = activeCount > 0 ? Math.round(totalRating / activeCount) : 0;

    // Render the summary card
    document.getElementById("avatar").textContent = generateAvatar(address);
    document.getElementById("freelancerAddress").textContent = address;
    document.getElementById("avgStars").innerHTML = renderStars(avgStarsNum);
    document.getElementById("reviewCount").textContent =
      activeCount + " active review" + (activeCount !== 1 ? "s" : "") +
      (revokedCount > 0 ? ", " + revokedCount + " revoked" : "");
    document.getElementById("totalReviews").textContent = activeCount;
    document.getElementById("avgRating").textContent = avgRating;
    document.getElementById("revokedCount").textContent = revokedCount;

    // Render individual review cards
    const reviewsList = document.getElementById("reviewsList");
    reviewsList.innerHTML = "";

    for (const r of reviews) {
      const card = document.createElement("div");
      card.className = "review-card" + (r.revoked ? " revoked" : "");

      card.innerHTML = `
        <div class="review-card-header">
          <span class="review-project">${escapeHtml(r.projectName)}</span>
          ${r.revoked ? '<span class="revoked-badge">Revoked</span>' : ""}
        </div>
        <div class="review-stars">${renderStars(r.rating)}</div>
        <p class="review-text">"${escapeHtml(r.reviewText)}"</p>
        <div class="review-meta">
          <span>By: ${r.reviewer.slice(0, 10)}... | ${r.date}</span>
          <a href="https://base-sepolia.easscan.org/attestation/view/${r.uid}" target="_blank" rel="noopener">
            View on-chain &rarr;
          </a>
        </div>
      `;

      reviewsList.appendChild(card);
    }

    show("results");

  } catch (err) {
    hide("loading");
    showError("Error querying the blockchain: " + err.message);
  }
}

/**
 * Escape HTML to prevent XSS -- review text comes from on-chain data
 * which anyone can write, so we must sanitize it before inserting into the DOM.
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Helper functions to show/hide elements
function show(id) {
  document.getElementById(id).classList.remove("hidden");
}

function hide(id) {
  document.getElementById(id).classList.add("hidden");
}

function showError(message) {
  document.getElementById("errorMessage").textContent = message;
  show("error");
}

// Allow pressing Enter to search
document.getElementById("addressInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") lookupReputation();
});
