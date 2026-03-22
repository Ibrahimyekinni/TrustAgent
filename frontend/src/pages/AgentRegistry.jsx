import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import AgentCard from "../components/AgentCard";
import Spinner from "../components/Spinner";

export default function AgentRegistry() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentReputation, setAgentReputation] = useState(null);
  const [loadingReputation, setLoadingReputation] = useState(false);
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validationHistory, setValidationHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Browse agents on load, or deep-link to a specific agent via ?id=X
  useEffect(() => {
    const deepLinkId = searchParams.get("id");
    if (deepLinkId && /^\d+$/.test(deepLinkId)) {
      // Deep-link: load specific agent by ID
      setLoading(true);
      fetch(`/api/agent-lookup?action=identity&agentId=${deepLinkId}`)
        .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
        .then((agent) => {
          setSelectedAgent(agent);
          loadReputation(agent.agentId);
          if (agent.owner) loadValidationHistory(agent.owner);
          setLoading(false);
        })
        .catch(() => {
          setError(`No agent found with ID ${deepLinkId}`);
          setLoading(false);
          loadAgents(1);
        });
      // Clear the query param so back button works cleanly
      setSearchParams({}, { replace: true });
    } else {
      loadAgents(1);
    }
  }, []);

  async function loadAgents(pageNum) {
    setLoading(true);
    setError("");
    try {
      const start = (pageNum - 1) * PAGE_SIZE + 1;
      const res = await fetch(`/api/agent-lookup?action=browse&start=${start}&count=${PAGE_SIZE}`);
      if (!res.ok) throw new Error("Failed to fetch agents");
      const data = await res.json();
      setAgents(data.agents || []);
      setPage(pageNum);
    } catch (err) {
      setError("Failed to load agents from the registry: " + err.message);
    }
    setLoading(false);
  }

  async function handleSearch() {
    const input = searchInput.trim();
    if (!input) return;

    setError("");
    setSelectedAgent(null);
    setAgentReputation(null);

    // If it's a number, treat as agent ID
    if (/^\d+$/.test(input)) {
      setLoading(true);
      try {
        const res = await fetch(`/api/agent-lookup?action=identity&agentId=${input}`);
        if (!res.ok) throw new Error("Agent not found");
        const agent = await res.json();
        setSelectedAgent(agent);
        loadReputation(agent.agentId);
        if (agent.owner) loadValidationHistory(agent.owner);
      } catch {
        setError(`No agent found with ID ${input}`);
      }
      setLoading(false);
      return;
    }

    // If it looks like an address, search by owner
    if (/^0x[0-9a-fA-F]{40}$/.test(input)) {
      setLoading(true);
      try {
        const res = await fetch(`/api/agent-lookup?action=search&address=${input}`);
        const data = await res.json();
        if (data.found) {
          setSelectedAgent(data);
          loadReputation(data.agentId);
          if (data.owner) loadValidationHistory(data.owner);
        } else {
          setError("No registered agent found for this address.");
        }
      } catch {
        setError("Failed to search for agent.");
      }
      setLoading(false);
      return;
    }

    setError("Enter an agent ID (number) or wallet address (0x...).");
  }

  async function loadReputation(agentId) {
    setLoadingReputation(true);
    try {
      const res = await fetch(`/api/agent-lookup?action=reputation&agentId=${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setAgentReputation(data);
      }
    } catch {
      // Non-critical
    }
    setLoadingReputation(false);
  }

  async function loadValidationHistory(address) {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/agent-lookup?action=validations&address=${address}`);
      if (res.ok) {
        const data = await res.json();
        setValidationHistory(data.validations || []);
      }
    } catch {
      // Non-critical
    }
    setLoadingHistory(false);
  }

  async function handleValidate(agentId) {
    setValidating(true);
    setValidation(null);
    try {
      const res = await fetch("/api/validate-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Validation failed");
      }
      const data = await res.json();
      setValidation(data);
    } catch (err) {
      setValidation({ error: err.message });
    }
    setValidating(false);
  }

  function selectAgent(agent) {
    setSelectedAgent(agent);
    setAgentReputation(null);
    setValidation(null);
    setValidationHistory([]);
    loadReputation(agent.agentId);
    if (agent.owner) loadValidationHistory(agent.owner);
  }

  function backToList() {
    setSelectedAgent(null);
    setAgentReputation(null);
    setValidation(null);
    setValidationHistory([]);
  }

  // ── Agent Detail View ──
  if (selectedAgent) {
    return (
      <div className="agent-registry-page">
        <button className="back-btn" onClick={backToList}>&larr; Back to Registry</button>

        <div className="agent-profile-card">
          <div className="agent-profile-header">
            {selectedAgent.image && !selectedAgent.image.includes("localhost") ? (
              <img
                src={selectedAgent.image}
                alt={selectedAgent.name}
                className="agent-profile-image"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            ) : (
              <div className="agent-profile-avatar">
                {selectedAgent.name?.charAt(0)?.toUpperCase() || "#"}
              </div>
            )}
            <div className="agent-profile-info">
              <h2>{selectedAgent.name}</h2>
              <span className="agent-card-id">Agent ID: {selectedAgent.agentId}</span>
              <span className={`agent-card-status ${selectedAgent.active ? "agent-card-status--active" : "agent-card-status--inactive"}`}>
                {selectedAgent.active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          {selectedAgent.description && (
            <p className="agent-profile-desc">{selectedAgent.description}</p>
          )}

          <div className="agent-profile-meta">
            <div className="agent-meta-item">
              <span className="agent-meta-label">Owner</span>
              <span className="agent-meta-value">{selectedAgent.owner}</span>
            </div>
            {selectedAgent.protocol && (
              <div className="agent-meta-item">
                <span className="agent-meta-label">Protocol</span>
                <span className="agent-meta-value">{selectedAgent.protocol}</span>
              </div>
            )}
            {selectedAgent.endpoints && selectedAgent.endpoints.length > 0 && (
              <div className="agent-meta-item">
                <span className="agent-meta-label">Endpoints</span>
                <div className="agent-endpoints">
                  {selectedAgent.endpoints.map((ep, i) => (
                    <span key={i} className="agent-endpoint-tag">
                      {ep.name || ep.endpoint || "endpoint"}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedAgent.supportedTrust && selectedAgent.supportedTrust.length > 0 && (
              <div className="agent-meta-item">
                <span className="agent-meta-label">Trust Models</span>
                <div className="agent-endpoints">
                  {selectedAgent.supportedTrust.map((t, i) => (
                    <span key={i} className="agent-endpoint-tag">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Reputation Section */}
        <div className="agent-reputation-section">
          <h3>On-Chain Reputation (ERC-8004)</h3>
          {loadingReputation && <Spinner message="Loading reputation data from the blockchain..." />}

          {agentReputation && !loadingReputation && (
            <>
              <div className="agent-reputation-summary">
                <div className="stat">
                  <span className="stat-value">{agentReputation.feedbackCount}</span>
                  <span className="stat-label">Total Feedback</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{agentReputation.avgScore}</span>
                  <span className="stat-label">Avg Score</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{agentReputation.clientCount}</span>
                  <span className="stat-label">Unique Clients</span>
                </div>
              </div>

              {agentReputation.dimensions && agentReputation.dimensions.length > 0 && (
                <div className="reputation-dimensions">
                  <h4>Reputation Dimensions</h4>
                  <div className="dimension-bars">
                    {agentReputation.dimensions.map((d) => (
                      <div key={d.tag} className="dimension-bar-row">
                        <span className="dimension-tag">{d.tag}</span>
                        <div className="dimension-bar-track">
                          <div
                            className="dimension-bar-fill"
                            style={{ width: `${Math.min(Math.max((d.avgScore / (Math.max(...agentReputation.dimensions.map(x => Math.abs(x.avgScore))) || 1)) * 100, 5), 100)}%` }}
                          />
                        </div>
                        <span className="dimension-value">{d.avgScore}</span>
                        <span className="dimension-count">({d.count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {agentReputation.feedback.length > 0 && (
                <div className="agent-feedback-list">
                  <h4>Feedback Entries</h4>
                  {agentReputation.feedback
                    .filter((f) => !f.revoked)
                    .map((fb, i) => (
                      <div key={i} className="agent-feedback-entry">
                        <div className="agent-feedback-header">
                          <span className={`agent-feedback-value ${fb.value >= 0 ? "agent-feedback-value--positive" : "agent-feedback-value--negative"}`}>
                            {fb.value >= 0 ? "+" : ""}{fb.value}
                          </span>
                          <div className="agent-feedback-tags">
                            {fb.tag1 && <span className="agent-feedback-tag">{fb.tag1}</span>}
                            {fb.tag2 && <span className="agent-feedback-tag">{fb.tag2}</span>}
                          </div>
                        </div>
                        <span className="agent-feedback-client" title={fb.client}>
                          From: {fb.client.slice(0, 8)}...{fb.client.slice(-4)}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {agentReputation.feedbackCount === 0 && (
                <p className="agent-no-feedback">No reputation feedback recorded yet for this agent.</p>
              )}
            </>
          )}
        </div>

        {/* Validation History Section */}
        <div className="validation-history-section">
          <h3>
            Validation History
            {validationHistory.length > 0 && (
              <span className="validation-history-count">({validationHistory.length})</span>
            )}
          </h3>

          {loadingHistory && <Spinner message="Loading past validations..." />}

          {!loadingHistory && validationHistory.length > 0 && (
            <div className="validation-history-list">
              {validationHistory.map((v) => (
                <div key={v.uid} className="validation-history-entry">
                  <div className={`validation-history-score validation-history-score--${v.verdict.toLowerCase()}`}>
                    {v.trustScore}%
                  </div>
                  <div className="validation-history-details">
                    <span className={`validation-history-verdict validation-verdict--${v.verdict.toLowerCase()}`}>
                      {v.verdict}
                    </span>
                    <span className="validation-history-date">
                      {new Date(v.date).toLocaleDateString()} at {new Date(v.date).toLocaleTimeString()}
                    </span>
                  </div>
                  <a
                    href={`https://base-sepolia.easscan.org/attestation/view/${v.uid}`}
                    target="_blank"
                    rel="noopener"
                    className="validation-history-link"
                  >
                    View on EASScan
                  </a>
                </div>
              ))}
            </div>
          )}

          {!loadingHistory && validationHistory.length === 0 && (
            <p className="validation-history-empty">
              No previous validations. Use the button below to validate this agent for the first time.
            </p>
          )}
        </div>

        {/* TrustAgent Validation Section */}
        <div className="validation-section">
          <h3>TrustAgent Validation</h3>
          <p className="validation-desc">
            TrustAgent (Agent #{1886}) is an autonomous AI trust validator registered on ERC-8004.
            It analyzes identity completeness, reputation data, and behavioral patterns to produce
            a verifiable trust score -- recorded permanently on-chain as an EAS attestation.
          </p>

          {!validation && !validating && (
            <button
              className="validate-btn"
              onClick={() => handleValidate(selectedAgent.agentId)}
            >
              Validate This Agent
            </button>
          )}

          {validating && <Spinner message="TrustAgent is analyzing this agent's on-chain data..." />}

          {validation && !validation.error && (
            <div className="validation-result">
              <div className="validation-header">
                <div className="validation-score-circle">
                  <span className="validation-score-number">{validation.validation.score}%</span>
                </div>
                <div className="validation-verdict-info">
                  <span className={`validation-verdict validation-verdict--${validation.validation.verdict.toLowerCase()}`}>
                    {validation.validation.verdict}
                  </span>
                  <span className="validation-meta">
                    Validated by TrustAgent (Agent #{validation.validation.validatedBy.agentId})
                  </span>
                  <span className="validation-meta">
                    {new Date(validation.validation.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              {validation.aiReport && (
                <div className="validation-ai-report">
                  <p className="validation-summary">{validation.aiReport.summary}</p>

                  {validation.aiReport.strengths && validation.aiReport.strengths.length > 0 && (
                    <div className="validation-factors">
                      <h4>Strengths</h4>
                      <ul>
                        {validation.aiReport.strengths.map((s, i) => (
                          <li key={i} className="validation-factor validation-factor--positive">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validation.aiReport.risks && validation.aiReport.risks.length > 0 && (
                    <div className="validation-factors">
                      <h4>Risk Factors</h4>
                      <ul>
                        {validation.aiReport.risks.map((r, i) => (
                          <li key={i} className="validation-factor validation-factor--negative">{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validation.aiReport.recommendation && (
                    <p className="validation-recommendation">
                      <strong>Recommendation:</strong> {validation.aiReport.recommendation}
                    </p>
                  )}
                </div>
              )}

              {validation.attestation && !validation.attestation.error && (
                <div className="validation-onchain">
                  <h4>On-Chain Proof</h4>
                  <p>This validation result has been permanently recorded on Base as an EAS attestation.</p>
                  <div className="validation-links">
                    {validation.attestation.easScanUrl && (
                      <a href={validation.attestation.easScanUrl} target="_blank" rel="noopener">
                        View on EASScan
                      </a>
                    )}
                    <a href={validation.attestation.baseScanUrl} target="_blank" rel="noopener">
                      View Transaction
                    </a>
                  </div>
                  <span className="validation-validator">
                    Signed by: {validation.attestation.validator}
                  </span>
                </div>
              )}

              {validation.attestation && validation.attestation.error && (
                <div className="validation-onchain-error">
                  <p>Analysis complete but on-chain attestation could not be submitted: {validation.attestation.error}</p>
                </div>
              )}
            </div>
          )}

          {validation && validation.error && (
            <div className="error" style={{ marginTop: "1rem" }}>
              <p>Validation failed: {validation.error}</p>
            </div>
          )}
        </div>

        {/* Blockchain proof */}
        <div className="proof-section">
          <h4>Verify On-Chain</h4>
          <p>
            This agent's identity is registered as ERC-8004 token #{selectedAgent.agentId} on{" "}
            <a
              href={`https://sepolia.basescan.org/address/${selectedAgent.owner}`}
              target="_blank"
              rel="noopener"
            >
              Base Sepolia
            </a>
            . Identity and reputation data can be independently verified by querying the{" "}
            <a
              href={`https://sepolia.basescan.org/address/0x8004A818BFB912233c491871b3d84c89A494BD9e`}
              target="_blank"
              rel="noopener"
            >
              Identity Registry
            </a>
            {" "}and{" "}
            <a
              href={`https://sepolia.basescan.org/address/0x8004B663056A597Dffe9eCcC1965A193B7388713`}
              target="_blank"
              rel="noopener"
            >
              Reputation Registry
            </a>
            {" "}contracts.
          </p>
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="agent-registry-page">
      <section className="search-section">
        <h2>Agent Registry</h2>
        <p className="search-description">
          Browse AI agents registered on-chain via ERC-8004. Each agent has a verifiable
          identity and reputation stored on Base -- no centralized registry can revoke it.
        </p>
        <div className="search-bar">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Agent ID (e.g. 1) or wallet address (0x...)"
            spellCheck="false"
          />
          <button onClick={handleSearch}>Search</button>
        </div>
      </section>

      {error && (
        <div className="error">
          <p>{error}</p>
        </div>
      )}

      {loading && <Spinner message="Loading agents from the ERC-8004 registry..." />}

      {!loading && agents.length > 0 && (
        <>
          <div className="agent-grid">
            {agents.map((agent) => (
              <AgentCard
                key={agent.agentId}
                agent={agent}
                onClick={() => selectAgent(agent)}
              />
            ))}
          </div>

          <div className="agent-pagination">
            {page > 1 && (
              <button onClick={() => loadAgents(page - 1)}>Previous</button>
            )}
            <span className="agent-page-info">
              Showing agents {(page - 1) * PAGE_SIZE + 1} - {(page - 1) * PAGE_SIZE + agents.length}
            </span>
            {agents.length === PAGE_SIZE && (
              <button onClick={() => loadAgents(page + 1)}>Next</button>
            )}
          </div>
        </>
      )}

      {!loading && agents.length === 0 && !error && (
        <div className="no-results">
          <h3>No agents found</h3>
          <p>No registered agents found in this range. Try searching by ID or address.</p>
        </div>
      )}
    </div>
  );
}
