import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Spinner from "../components/Spinner";

const VALIDATION_SCHEMA = "0xc58d7a957517d2d26433311d878f926f4fe2ca91445186a3976d5f354206b6b0";
const TRUSTAGENT_WALLET = "0x12e38f09f8d39Ba1B18Ec2d158cAB0DD92D45eEa";
const EAS_GRAPHQL = "https://base-sepolia.easscan.org/graphql";

export default function Activity() {
  const [validations, setValidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAllValidations();
  }, []);

  async function fetchAllValidations() {
    try {
      const query = `
        query GetAllValidations($where: AttestationWhereInput) {
          attestations(where: $where, orderBy: [{ time: desc }]) {
            id
            time
            revocationTime
            recipient
            data
          }
        }
      `;

      const res = await fetch(EAS_GRAPHQL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          variables: {
            where: {
              schemaId: { equals: VALIDATION_SCHEMA },
              attester: { equals: TRUSTAGENT_WALLET },
            },
          },
        }),
      });

      const result = await res.json();
      if (result.errors) throw new Error(result.errors[0].message);

      const decoded = [];
      for (const a of result.data.attestations || []) {
        const revoked = a.revocationTime !== 0 && a.revocationTime !== "0";
        let agentId = 0, trustScore = 0, verdict = "", reportHash = "";
        try {
          // Decode ABI-encoded data client-side using manual parsing
          const data = a.data.startsWith("0x") ? a.data.slice(2) : a.data;
          const SLOT = 64;
          agentId = parseInt(data.slice(0, SLOT), 16);
          trustScore = parseInt(data.slice(SLOT, 2 * SLOT), 16);

          // Verdict is a dynamic string -- offset at slot 2, then length + content
          const verdictOffset = parseInt(data.slice(2 * SLOT, 3 * SLOT), 16) * 2;
          const verdictLen = parseInt(data.slice(verdictOffset, verdictOffset + SLOT), 16);
          const verdictHex = data.slice(verdictOffset + SLOT, verdictOffset + SLOT + verdictLen * 2);
          verdict = "";
          for (let i = 0; i < verdictHex.length; i += 2) {
            verdict += String.fromCharCode(parseInt(verdictHex.slice(i, i + 2), 16));
          }
        } catch { /* skip decode errors */ }

        decoded.push({
          uid: a.id,
          date: new Date(parseInt(a.time) * 1000).toISOString(),
          recipient: a.recipient,
          agentId,
          trustScore,
          verdict,
          revoked,
        });
      }

      setValidations(decoded);
    } catch (err) {
      setError("Failed to load validation history: " + err.message);
    }
    setLoading(false);
  }

  // Compute summary stats
  const active = validations.filter((v) => !v.revoked);
  const avgScore = active.length > 0
    ? Math.round(active.reduce((sum, v) => sum + v.trustScore, 0) / active.length)
    : 0;

  const verdictCounts = {};
  for (const v of active) {
    verdictCounts[v.verdict] = (verdictCounts[v.verdict] || 0) + 1;
  }

  return (
    <div className="activity-page">
      <section className="search-section">
        <h2>TrustAgent Activity</h2>
        <p className="search-description">
          Every validation TrustAgent (Agent #1886) has performed, permanently recorded on-chain
          as EAS attestations. This is the full track record of an autonomous AI trust validator.
        </p>
      </section>

      {error && (
        <div className="error"><p>{error}</p></div>
      )}

      {loading && <Spinner message="Loading validation history from the blockchain..." />}

      {!loading && active.length > 0 && (
        <>
          {/* Summary stats */}
          <div className="activity-summary">
            <div className="activity-stat glass-card">
              <span className="activity-stat-number">{active.length}</span>
              <span className="activity-stat-label">Agents Validated</span>
            </div>
            <div className="activity-stat glass-card">
              <span className="activity-stat-number">{avgScore}%</span>
              <span className="activity-stat-label">Avg Trust Score</span>
            </div>
            {Object.entries(verdictCounts).map(([verdict, count]) => (
              <div key={verdict} className="activity-stat glass-card">
                <span className={`activity-stat-number activity-stat-number--${verdict.toLowerCase()}`}>{count}</span>
                <span className="activity-stat-label">{verdict}</span>
              </div>
            ))}
          </div>

          {/* Validation list */}
          <div className="activity-list">
            {validations.map((v) => (
              <div key={v.uid} className={`activity-entry ${v.revoked ? "activity-entry--revoked" : ""}`}>
                <div className={`activity-score activity-score--${v.verdict.toLowerCase()}`}>
                  {v.trustScore}%
                </div>
                <div className="activity-details">
                  <div className="activity-details-top">
                    <span className={`validation-verdict validation-verdict--${v.verdict.toLowerCase()}`}>
                      {v.verdict}
                    </span>
                    <Link to={`/agents?id=${v.agentId}`} className="activity-agent-link">
                      Agent #{v.agentId}
                    </Link>
                    {v.revoked && <span className="activity-revoked-badge">REVOKED</span>}
                  </div>
                  <span className="activity-date">
                    {new Date(v.date).toLocaleDateString()} at {new Date(v.date).toLocaleTimeString()}
                  </span>
                  <span className="activity-recipient" title={v.recipient}>
                    Recipient: {v.recipient.slice(0, 8)}...{v.recipient.slice(-4)}
                  </span>
                </div>
                <a
                  href={`https://base-sepolia.easscan.org/attestation/view/${v.uid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="activity-proof-link"
                >
                  EASScan
                </a>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && validations.length === 0 && !error && (
        <div className="no-results">
          <h3>No validations yet</h3>
          <p>TrustAgent hasn't performed any validations. Visit the Agent Registry to validate an agent.</p>
        </div>
      )}
    </div>
  );
}
