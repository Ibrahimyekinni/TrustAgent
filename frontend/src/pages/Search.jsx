import { useState } from "react";
import { Link } from "react-router-dom";
import { fetchAttestations, decodeAttestationData, isValidAddress, generateAvatar, looksLikeEnsName, resolveEnsName } from "../utils/eas";
import Stars from "../components/Stars";
import ReviewCard from "../components/ReviewCard";
import Spinner from "../components/Spinner";
import TrustScore from "../components/TrustScore";

const DEMO_ADDRESS = "0x12e38f09f8d39Ba1B18Ec2d158cAB0DD92D45eEa";

export default function Search() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null); // { reviews, activeCount, revokedCount, avgRating, avgStarsNum }
  const [noResults, setNoResults] = useState(false);
  const [resolvedName, setResolvedName] = useState(""); // shows the ENS name that was resolved
  const [erc8004Agent, setErc8004Agent] = useState(null); // ERC-8004 identity if found

  async function handleSearch(searchAddress) {
    let addr = (searchAddress || address).trim();

    if (!addr) {
      setError("Please enter a wallet address or ENS name.");
      return;
    }

    setError("");
    setResults(null);
    setNoResults(false);
    setResolvedName("");
    setErc8004Agent(null);
    setLoading(true);

    // If it looks like an ENS/Basename, resolve it first
    if (!isValidAddress(addr) && looksLikeEnsName(addr)) {
      try {
        const resolved = await resolveEnsName(addr);
        if (!resolved) {
          setError(`Could not resolve "${addr}" -- no address found for that name.`);
          setLoading(false);
          return;
        }
        setResolvedName(addr);
        addr = resolved;
        setAddress(resolved);
      } catch (err) {
        setError(`Failed to resolve "${addr}": ${err.message}`);
        setLoading(false);
        return;
      }
    } else if (!isValidAddress(addr)) {
      setError("Invalid input. Enter a wallet address (0x...) or an ENS name (e.g. vitalik.eth).");
      setLoading(false);
      return;
    }

    try {
      const attestations = await fetchAttestations(addr);

      if (attestations.length === 0) {
        setNoResults(true);
        setLoading(false);
        return;
      }

      const reviews = [];
      let totalRating = 0;
      let activeCount = 0;
      let revokedCount = 0;

      for (const att of attestations) {
        const decoded = decodeAttestationData(att.data, att.schemaId);
        const isRevoked = parseInt(att.revocationTime) > 0;

        reviews.push({
          projectName: decoded.projectName,
          rating: decoded.rating,
          reviewText: decoded.review,
          proofURI: decoded.proofURI || "",
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

      setResults({ reviews, activeCount, revokedCount, avgRating, avgStarsNum, address: addr });
      setLoading(false);

      // Cross-reference: check if this wallet has an ERC-8004 registered agent identity
      fetch(`/api/agent-lookup?action=search&address=${addr}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data && data.found !== false && data.agentId) {
            // Also fetch reputation for trust score integration
            fetch(`/api/agent-lookup?action=reputation&agentId=${data.agentId}`)
              .then((r) => r.ok ? r.json() : null)
              .then((rep) => {
                setErc8004Agent({ identity: data, reputation: rep });
              })
              .catch(() => setErc8004Agent({ identity: data, reputation: null }));
          }
        })
        .catch(() => {});
    } catch (err) {
      setLoading(false);
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        setError("Network error -- couldn't reach the EAS indexer. Check your internet connection and try again.");
      } else {
        setError("Error querying the blockchain: " + err.message);
      }
    }
  }

  function useDemoAddress() {
    setAddress(DEMO_ADDRESS);
    handleSearch(DEMO_ADDRESS);
  }

  return (
    <div className="search-page">
      <section className="search-section">
        <h2>Look up on-chain reputation</h2>
        <p className="search-description">
          Enter a wallet address to see on-chain reviews and reputation data. Reviews are
          stored on Base (Ethereum L2) using EAS attestations. If the address has a registered
          ERC-8004 agent identity, that data is cross-referenced for a deeper trust analysis.
        </p>
        <div className="search-bar">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="0x... or name.eth or name.base.eth"
            spellCheck="false"
          />
          <button onClick={() => handleSearch()}>Search</button>
        </div>
        <p className="demo-hint">
          Try the demo address:{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); useDemoAddress(); }}>
            {DEMO_ADDRESS}
          </a>
        </p>
      </section>

      {/* Resolved ENS name */}
      {resolvedName && results && (
        <div className="resolved-name">
          <p>Resolved <strong>{resolvedName}</strong> to <code>{results.address}</code></p>
        </div>
      )}

      {/* Loading */}
      {loading && <Spinner message="Querying the blockchain..." />}

      {/* Error */}
      {error && (
        <div className="error">
          <p>{error}</p>
        </div>
      )}

      {/* No results */}
      {noResults && (
        <div className="no-results">
          <h3>No reviews found</h3>
          <p>This address has no on-chain reviews yet, or the address may be incorrect.</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <section className="results">
          {/* Summary Card */}
          <div className="summary-card">
            <div className="summary-header">
              {(() => {
                const av = generateAvatar(results.address);
                return <div className="avatar" style={{ background: av.bg }}>{av.initials}</div>;
              })()}
              <div className="summary-info">
                <h3>{resolvedName || `${results.address.slice(0, 6)}...${results.address.slice(-4)}`}</h3>
                {resolvedName && <p className="resolved-address">{results.address}</p>}
                <Stars rating={results.avgStarsNum} size="lg" />
                <p className="review-count">
                  {results.activeCount} active review{results.activeCount !== 1 ? "s" : ""}
                  {results.revokedCount > 0 ? `, ${results.revokedCount} revoked` : ""}
                </p>
              </div>
            </div>
            <div className="summary-stats">
              <div className="stat">
                <span className="stat-value">{results.activeCount}</span>
                <span className="stat-label">Total Reviews</span>
              </div>
              <div className="stat">
                <span className="stat-value">{results.avgRating}</span>
                <span className="stat-label">Avg Rating</span>
              </div>
              <div className="stat">
                <span className="stat-value">{results.revokedCount}</span>
                <span className="stat-label">Revoked</span>
              </div>
            </div>
          </div>

          {/* ERC-8004 Registered Agent Badge */}
          {erc8004Agent && (
            <div className="erc8004-badge-card">
              <div className="erc8004-badge-header">
                <span className="erc8004-badge-icon">VERIFIED</span>
                <span className="erc8004-badge-title">Registered ERC-8004 Agent</span>
              </div>
              <div className="erc8004-badge-details">
                <span className="erc8004-badge-name">{erc8004Agent.identity.name}</span>
                <span className="erc8004-badge-id">Agent #{erc8004Agent.identity.agentId}</span>
                {erc8004Agent.reputation && erc8004Agent.reputation.feedbackCount > 0 && (
                  <span className="erc8004-badge-rep">
                    {erc8004Agent.reputation.feedbackCount} feedback entries | Avg: {erc8004Agent.reputation.avgScore}
                  </span>
                )}
              </div>
              <Link to="/agents" className="erc8004-badge-link">
                View in Agent Registry
              </Link>
            </div>
          )}

          {/* Trust Analysis */}
          <TrustScore results={results} erc8004Data={erc8004Agent} />

          {/* Reviews list */}
          <div className="reviews-section">
            <h3>Reviews</h3>
            {results.reviews.map((review) => (
              <ReviewCard key={review.uid} review={review} />
            ))}
          </div>

          {/* Blockchain proof */}
          <div className="proof-section">
            <h4>Blockchain Verification</h4>
            <p>
              All reviews are stored as EAS attestations on{" "}
              <a href="https://base-sepolia.easscan.org" target="_blank" rel="noopener noreferrer">
                Base Sepolia
              </a>
              . Each review can be independently verified -- click "Verify" on any
              review to see its on-chain proof.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
