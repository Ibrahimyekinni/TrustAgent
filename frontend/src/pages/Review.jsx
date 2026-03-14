import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { connectWallet } from "../utils/wallet";
import { isValidAddress, EAS_CONTRACT_ADDRESS, EAS_ABI, SCHEMA_UID_V2 } from "../utils/eas";
import StarSelector from "../components/StarSelector";
import Spinner from "../components/Spinner";

export default function Review() {
  const [wallet, setWallet] = useState({ address: null, signer: null });
  const [form, setForm] = useState({
    freelancerAddress: "",
    projectName: "",
    rating: 0,
    reviewText: "",
    proofURI: "",
  });
  const [txState, setTxState] = useState("idle"); // idle | pending | success | error
  const [txMessage, setTxMessage] = useState("");
  const [txResult, setTxResult] = useState(null); // { attestationUID, txHash }

  // Listen for MetaMask account/chain changes
  useEffect(() => {
    if (typeof window.ethereum === "undefined") return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        setWallet({ address: null, signer: null });
      } else {
        handleConnect();
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  async function handleConnect() {
    try {
      const { address, signer } = await connectWallet();
      setWallet({ address, signer });
    } catch (err) {
      alert(err.message || "Failed to connect wallet");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!wallet.signer) {
      alert("Please connect your wallet first.");
      return;
    }

    const { freelancerAddress, projectName, rating, reviewText, proofURI } = form;

    if (!isValidAddress(freelancerAddress)) {
      alert("Invalid freelancer wallet address.");
      return;
    }
    if (!projectName.trim()) {
      alert("Please enter a project name.");
      return;
    }
    if (rating < 1 || rating > 5) {
      alert("Please select a rating (1-5 stars).");
      return;
    }
    if (!reviewText.trim()) {
      alert("Please write a review.");
      return;
    }

    setTxState("pending");
    setTxMessage("Encoding review data...");
    setTxResult(null);

    try {
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const encodedData = abiCoder.encode(
        ["address", "string", "uint8", "string", "string"],
        [freelancerAddress, projectName, rating, reviewText, proofURI || ""]
      );

      const attestationRequest = {
        schema: SCHEMA_UID_V2,
        data: {
          recipient: freelancerAddress,
          expirationTime: 0n,
          revocable: true,
          refUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
          data: encodedData,
          value: 0n,
        },
      };

      setTxMessage("Waiting for MetaMask confirmation...");

      const easContract = new ethers.Contract(EAS_CONTRACT_ADDRESS, EAS_ABI, wallet.signer);
      const tx = await easContract.attest(attestationRequest);

      setTxMessage("Transaction submitted! Waiting for confirmation...");

      const receipt = await tx.wait();

      let attestationUID = "";
      for (const log of receipt.logs) {
        if (log.topics.length >= 4) {
          attestationUID = log.data.slice(0, 66);
          break;
        }
      }

      setTxResult({ attestationUID, txHash: receipt.hash, projectName, rating });
      setTxState("success");

      // Reset form
      setForm({ freelancerAddress: "", projectName: "", rating: 0, reviewText: "", proofURI: "" });
    } catch (err) {
      setTxState("error");
      if (err.code === "ACTION_REJECTED" || err.code === 4001) {
        setTxMessage("Transaction cancelled by user.");
      } else {
        setTxMessage("Error: " + (err.reason || err.message || err));
      }
    }
  }

  const isConnected = !!wallet.address;

  return (
    <div className="review-page">
      <section className="review-form-section">
        <h2>Leave a Review</h2>
        <p className="search-description">
          Submit an on-chain review for a freelancer. Your review is stored permanently
          on the blockchain -- no platform can delete or modify it.
        </p>

        {/* Wallet Connection */}
        <div className="wallet-bar">
          <div className="wallet-status">
            <span className={`wallet-dot ${isConnected ? "wallet-dot--connected" : "wallet-dot--disconnected"}`} />
            <span>
              {isConnected
                ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)} (Base Sepolia)`
                : "No wallet connected"}
            </span>
          </div>
          <button
            className="connect-btn"
            onClick={handleConnect}
            disabled={isConnected}
          >
            {isConnected ? "Connected" : "Connect Wallet"}
          </button>
        </div>

        {/* Review Form */}
        <form className="review-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reviewAddress">Freelancer Wallet Address</label>
            <input
              type="text"
              id="reviewAddress"
              placeholder="0x... (the freelancer you're reviewing)"
              spellCheck="false"
              required
              value={form.freelancerAddress}
              onChange={(e) => setForm({ ...form, freelancerAddress: e.target.value })}
            />
          </div>

          <div className="form-row">
            <div className="form-group form-group--flex">
              <label htmlFor="reviewProject">Project Name</label>
              <input
                type="text"
                id="reviewProject"
                placeholder="e.g. Logo Design, Chatbot Build"
                required
                value={form.projectName}
                onChange={(e) => setForm({ ...form, projectName: e.target.value })}
              />
            </div>

            <div className="form-group form-group--rating">
              <label>Rating</label>
              <StarSelector
                value={form.rating}
                onChange={(r) => setForm({ ...form, rating: r })}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reviewText">Review</label>
            <textarea
              id="reviewText"
              placeholder="How was your experience working with this freelancer?"
              rows="3"
              required
              value={form.reviewText}
              onChange={(e) => setForm({ ...form, reviewText: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="reviewProof">Proof of Work (optional)</label>
            <input
              type="url"
              id="reviewProof"
              placeholder="Link to proof -- Google Drive, GitHub, invoice, etc."
              value={form.proofURI}
              onChange={(e) => setForm({ ...form, proofURI: e.target.value })}
            />
            <span className="form-hint">Attach a link to evidence that work was completed. This gets stored on-chain.</span>
          </div>

          <button
            type="submit"
            className="submit-btn"
            disabled={!isConnected || txState === "pending"}
          >
            {isConnected ? "Submit Review On-Chain" : "Connect wallet to submit"}
          </button>
        </form>

        {/* Transaction Status */}
        {txState === "pending" && <Spinner message={txMessage} />}

        {/* Transaction Error */}
        {txState === "error" && (
          <div className="error" style={{ marginTop: "1rem" }}>
            <p>{txMessage}</p>
          </div>
        )}

        {/* Transaction Success */}
        {txState === "success" && txResult && (
          <div className="tx-success">
            <h3>Review submitted on-chain!</h3>
            <p>
              Your review for {txResult.projectName} ({txResult.rating}/5) has been permanently recorded on Base.
            </p>
            {txResult.attestationUID ? (
              <a
                href={`https://base-sepolia.easscan.org/attestation/view/${txResult.attestationUID}`}
                target="_blank"
                rel="noopener"
              >
                View on EASScan
              </a>
            ) : (
              <a
                href={`https://sepolia.basescan.org/tx/${txResult.txHash}`}
                target="_blank"
                rel="noopener"
              >
                View transaction
              </a>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
