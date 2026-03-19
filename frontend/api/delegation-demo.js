// Vercel serverless function -- TrustEnforcer Delegation Demo
// Simulates what the MetaMask DelegationManager would do by calling
// TrustEnforcer's beforeHook() via staticCall (read-only, no gas).
// This proves the enforcer works with real on-chain EAS attestation data.

let ethersModule;
async function getEthers() {
  if (!ethersModule) ethersModule = await import("ethers");
  return ethersModule;
}

// ── Contract addresses (Base Sepolia) ──
const TRUST_ENFORCER_ADDRESS = "0x3Fc881e22190B672d4B9621e2E8AC95197BD61bc";
const EAS_CONTRACT = "0x4200000000000000000000000000000000000021";
const VALIDATION_SCHEMA_UID = "0xc58d7a957517d2d26433311d878f926f4fe2ca91445186a3976d5f354206b6b0";
const TRUSTED_ATTESTER = "0x12e38f09f8d39Ba1B18Ec2d158cAB0DD92D45eEa"; // TrustAgent's wallet
const RPC_URL = "https://sepolia.base.org";

const TRUST_ENFORCER_ABI = [
  "function beforeHook(bytes calldata terms, bytes calldata args, bytes32 mode, bytes calldata executionCallData, bytes32 delegationHash) external view",
];

const EAS_ABI = [
  "function getAttestation(bytes32 uid) external view returns (tuple(bytes32 uid, bytes32 schema, uint64 time, uint64 expirationTime, uint64 revocationTime, bytes32 refUID, address attester, address recipient, bool revocable, bytes data))",
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action } = req.body;

  if (action === "test-enforcer") {
    return await testEnforcer(req, res);
  }

  return res.status(400).json({ error: "Unknown action. Use: test-enforcer" });
}

async function testEnforcer(req, res) {
  const { attestationUID, minTrustScore } = req.body;

  if (!attestationUID) {
    return res.status(400).json({ error: "Missing attestationUID" });
  }

  const threshold = Math.min(100, Math.max(0, parseInt(minTrustScore) || 50));
  const { ethers } = await getEthers();
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  try {
    // First, read the attestation directly to get details for the response
    const easContract = new ethers.Contract(EAS_CONTRACT, EAS_ABI, provider);
    const att = await easContract.getAttestation(attestationUID);

    // Check if attestation exists
    if (att.uid === ethers.ZeroHash) {
      return res.status(400).json({
        approved: false,
        reason: "Attestation not found",
        details: "The provided attestation UID does not exist on-chain.",
      });
    }

    // Decode the trust score from attestation data
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    let agentId, trustScore, verdict, reportHash;
    try {
      [agentId, trustScore, verdict, reportHash] = abiCoder.decode(
        ["uint256", "uint8", "string", "string"],
        att.data
      );
    } catch {
      return res.status(400).json({
        approved: false,
        reason: "Invalid attestation data",
        details: "Could not decode trust score from attestation. Make sure this is a TrustAgent validation attestation.",
      });
    }

    // Encode terms (what the delegator would set)
    const terms = abiCoder.encode(
      ["address", "address", "bytes32", "uint8"],
      [EAS_CONTRACT, TRUSTED_ATTESTER, VALIDATION_SCHEMA_UID, threshold]
    );

    // Encode args (what the redeemer would provide)
    const args = abiCoder.encode(["bytes32"], [attestationUID]);

    // Call beforeHook via staticCall (read-only simulation)
    const enforcer = new ethers.Contract(TRUST_ENFORCER_ADDRESS, TRUST_ENFORCER_ABI, provider);

    const dummyMode = ethers.ZeroHash;
    const dummyCallData = "0x";
    const dummyDelegationHash = ethers.ZeroHash;

    try {
      await enforcer.beforeHook.staticCall(terms, args, dummyMode, dummyCallData, dummyDelegationHash);

      // If we get here, the enforcer approved the delegation
      return res.status(200).json({
        approved: true,
        trustScore: Number(trustScore),
        minRequired: threshold,
        verdict: verdict,
        agentId: Number(agentId),
        attestationUID,
        attester: att.attester,
        recipient: att.recipient,
        proof: {
          enforcerContract: TRUST_ENFORCER_ADDRESS,
          enforcerBaseScan: `https://sepolia.basescan.org/address/${TRUST_ENFORCER_ADDRESS}`,
          attestationEASScan: `https://base-sepolia.easscan.org/attestation/view/${attestationUID}`,
          schemaEASScan: `https://base-sepolia.easscan.org/schema/view/${VALIDATION_SCHEMA_UID}`,
        },
      });
    } catch (err) {
      // The enforcer reverted -- delegation blocked
      const errorMessage = err.message || "";

      let reason = "Delegation blocked by TrustEnforcer";
      let details = "";

      if (errorMessage.includes("TrustScoreTooLow")) {
        reason = "Trust score too low";
        details = `Agent trust score is ${Number(trustScore)}% but minimum required is ${threshold}%`;
      } else if (errorMessage.includes("WrongSchema")) {
        reason = "Wrong attestation schema";
        details = "This attestation was not created using the TrustAgent validation schema.";
      } else if (errorMessage.includes("UntrustedAttester")) {
        reason = "Untrusted attester";
        details = "This attestation was not created by TrustAgent's wallet.";
      } else if (errorMessage.includes("AttestationRevoked")) {
        reason = "Attestation revoked";
        details = "This validation attestation has been revoked.";
      } else if (errorMessage.includes("AttestationExpired")) {
        reason = "Attestation expired";
        details = "This validation attestation has expired.";
      } else if (errorMessage.includes("RecipientMismatch")) {
        reason = "Recipient mismatch";
        details = "The attestation recipient does not match the delegate.";
      } else if (errorMessage.includes("InvalidAttestationUID")) {
        reason = "Invalid attestation";
        details = "The attestation UID is invalid or does not exist.";
      }

      return res.status(200).json({
        approved: false,
        reason,
        details,
        trustScore: Number(trustScore),
        minRequired: threshold,
        verdict: verdict,
        agentId: Number(agentId),
        attestationUID,
        proof: {
          enforcerContract: TRUST_ENFORCER_ADDRESS,
          enforcerBaseScan: `https://sepolia.basescan.org/address/${TRUST_ENFORCER_ADDRESS}`,
          attestationEASScan: `https://base-sepolia.easscan.org/attestation/view/${attestationUID}`,
          schemaEASScan: `https://base-sepolia.easscan.org/schema/view/${VALIDATION_SCHEMA_UID}`,
        },
      });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to test enforcer" });
  }
}
