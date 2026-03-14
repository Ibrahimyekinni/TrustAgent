/**
 * EAS (Ethereum Attestation Service) utilities
 * Constants, encoding/decoding, and GraphQL queries
 */

export const EAS_GRAPHQL_URL = "https://base-sepolia.easscan.org/graphql";
export const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021";

// V1 schema: address freelancer, string projectName, uint8 rating, string review
export const SCHEMA_UID_V1 = "0x5d6661abb66715bfc01d1744f52f52594c1b01ed473d9facb2825988ef70ce30";
// V2 schema: adds string proofURI
export const SCHEMA_UID_V2 = "0xb529f19655a454738a3be1bbe2c84d69d34b19cb3ca85672b005f27db42418f1";

// EAS contract ABI -- just the attest function
export const EAS_ABI = [
  "function attest((bytes32 schema, (address recipient, uint64 expirationTime, bool revocable, bytes32 refUID, bytes data, uint256 value) data)) external payable returns (bytes32)",
];

/**
 * Decode raw EAS attestation hex data into readable values.
 * Handles both V1 (4 fields) and V2 (5 fields with proofURI).
 */
export function decodeAttestationData(hexData, schemaId) {
  const data = hexData.startsWith("0x") ? hexData.slice(2) : hexData;
  const SLOT = 64;
  const readSlot = (index) => data.slice(index * SLOT, (index + 1) * SLOT);

  const readString = (charOffset) => {
    const lengthHex = data.slice(charOffset, charOffset + SLOT);
    const length = parseInt(lengthHex, 16);
    const stringHex = data.slice(charOffset + SLOT, charOffset + SLOT + length * 2);
    let str = "";
    for (let i = 0; i < stringHex.length; i += 2) {
      str += String.fromCharCode(parseInt(stringHex.slice(i, i + 2), 16));
    }
    return str;
  };

  const freelancer = "0x" + readSlot(0).slice(-40);
  const projectNameOffset = parseInt(readSlot(1), 16) * 2;
  const rating = parseInt(readSlot(2), 16);
  const reviewOffset = parseInt(readSlot(3), 16) * 2;

  const projectName = readString(projectNameOffset);
  const review = readString(reviewOffset);

  let proofURI = "";
  if (schemaId === SCHEMA_UID_V2) {
    const proofOffset = parseInt(readSlot(4), 16) * 2;
    proofURI = readString(proofOffset);
  }

  return { freelancer, projectName, rating, review, proofURI };
}

/**
 * Fetch all attestations (V1 + V2) for a given address.
 */
export async function fetchAttestations(address) {
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

  const [v1Response, v2Response] = await Promise.all([
    fetch(EAS_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { where: { schemaId: { equals: SCHEMA_UID_V1 }, recipient: { equals: address } } },
      }),
    }),
    fetch(EAS_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { where: { schemaId: { equals: SCHEMA_UID_V2 }, recipient: { equals: address } } },
      }),
    }),
  ]);

  const [v1Result, v2Result] = await Promise.all([v1Response.json(), v2Response.json()]);

  if (v1Result.errors) throw new Error(v1Result.errors[0].message);
  if (v2Result.errors) throw new Error(v2Result.errors[0].message);

  // Combine and sort by time descending
  return [
    ...v1Result.data.attestations,
    ...v2Result.data.attestations,
  ].sort((a, b) => parseInt(b.time) - parseInt(a.time));
}

export function isValidAddress(address) {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

export function generateAvatar(address) {
  return address.slice(2, 4).toUpperCase();
}
