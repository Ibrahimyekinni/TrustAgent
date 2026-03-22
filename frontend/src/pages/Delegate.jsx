import { useState } from "react";
import Spinner from "../components/Spinner";

const TRUST_ENFORCER_ADDRESS = "0x3Fc881e22190B672d4B9621e2E8AC95197BD61bc";

export default function Delegate() {
  const [agentId, setAgentId] = useState("");
  const [minScore, setMinScore] = useState(50);
  const [step, setStep] = useState(0); // 0=input, 1=validating, 2=validated, 3=testing, 4=result

  // Validation state
  const [validation, setValidation] = useState(null);
  const [validationError, setValidationError] = useState("");

  // Delegation test state
  const [delegationResult, setDelegationResult] = useState(null);
  const [delegationError, setDelegationError] = useState("");

  async function handleValidate() {
    if (!agentId || isNaN(parseInt(agentId))) return;

    setStep(1);
    setValidation(null);
    setValidationError("");
    setDelegationResult(null);
    setDelegationError("");

    try {
      const res = await fetch("/api/validate-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: parseInt(agentId) }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Validation failed");
      }

      const data = await res.json();
      setValidation(data);
      setStep(2);
    } catch (err) {
      setValidationError(err.message);
      setStep(0);
    }
  }

  async function handleTestDelegation() {
    if (!validation?.attestation?.attestationUID) return;

    setStep(3);
    setDelegationResult(null);
    setDelegationError("");

    try {
      const res = await fetch("/api/delegation-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test-enforcer",
          attestationUID: validation.attestation.attestationUID,
          minTrustScore: minScore,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Enforcer test failed");
      }

      const data = await res.json();
      setDelegationResult(data);
      setStep(4);
    } catch (err) {
      setDelegationError(err.message);
      setStep(4);
    }
  }

  function handleReset() {
    setStep(0);
    setAgentId("");
    setMinScore(50);
    setValidation(null);
    setValidationError("");
    setDelegationResult(null);
    setDelegationError("");
  }

  function handleRetestWithNewThreshold() {
    setStep(2);
    setDelegationResult(null);
    setDelegationError("");
  }

  return (
    <div className="delegate-page">
      {/* Header */}
      <section className="delegate-header">
        <h2>Trust-Gated Delegation</h2>
        <p className="delegate-subtitle">
          Before delegating authority to an AI agent, TrustAgent validates it. If the trust
          score is too low, the delegation is blocked at the smart contract level -- powered
          by the MetaMask Delegation Framework.
        </p>
      </section>

      {/* How It Works */}
      <div className="delegate-flow-card">
        <h3>How It Works</h3>
        <div className="delegate-flow-diagram">
          <div className="delegate-flow-step">
            <div className="delegate-flow-icon">1</div>
            <div className="delegate-flow-text">
              <strong>Validate Agent</strong>
              <span>TrustAgent analyzes the agent's on-chain identity and reputation, then records a trust score as an EAS attestation</span>
            </div>
          </div>
          <div className="delegate-flow-arrow"></div>
          <div className="delegate-flow-step">
            <div className="delegate-flow-icon">2</div>
            <div className="delegate-flow-text">
              <strong>Set Threshold</strong>
              <span>Choose the minimum trust score required for delegation (e.g., 50%)</span>
            </div>
          </div>
          <div className="delegate-flow-arrow"></div>
          <div className="delegate-flow-step">
            <div className="delegate-flow-icon">3</div>
            <div className="delegate-flow-text">
              <strong>TrustEnforcer Checks</strong>
              <span>The smart contract reads the EAS attestation on-chain and approves or blocks the delegation</span>
            </div>
          </div>
        </div>
      </div>

      {/* Try It Section */}
      <div className="delegate-demo-card">
        <h3>Try It</h3>

        {/* Step 1: Agent ID Input */}
        <div className="delegate-input-group">
          <label htmlFor="delegate-agent-id">Agent ID</label>
          <div className="delegate-input-row">
            <input
              id="delegate-agent-id"
              type="number"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && step === 0 && handleValidate()}
              placeholder="e.g. 5"
              disabled={step > 0}
              min="1"
            />
            {step === 0 && (
              <button
                className="delegate-btn delegate-btn--validate"
                onClick={handleValidate}
                disabled={!agentId || isNaN(parseInt(agentId))}
              >
                Step 1 -- Validate Agent
              </button>
            )}
          </div>
        </div>

        {validationError && (
          <div className="delegate-error">
            <p>{validationError}</p>
          </div>
        )}

        {/* Validating spinner */}
        {step === 1 && (
          <Spinner message="TrustAgent is analyzing this agent's on-chain data and recording the result..." />
        )}

        {/* Step 2: Validation Result + Threshold */}
        {step >= 2 && validation && (
          <div className="delegate-validation-result">
            <div className="delegate-validation-header">
              <div className={`delegate-score-badge delegate-score-badge--${validation.validation.verdict.toLowerCase()}`}>
                <span className="delegate-score-number">{validation.validation.score}%</span>
                <span className="delegate-score-verdict">{validation.validation.verdict}</span>
              </div>
              <div className="delegate-validation-info">
                <span className="delegate-agent-name">{validation.agent.name}</span>
                <span className="delegate-agent-meta">Agent #{validation.agent.agentId}</span>
                {validation.attestation?.attestationUID && (
                  <a
                    href={validation.attestation.easScanUrl}
                    target="_blank"
                    rel="noopener"
                    className="delegate-proof-link"
                  >
                    View attestation on EASScan
                  </a>
                )}
              </div>
            </div>

            {validation.aiReport?.summary && (
              <p className="delegate-ai-summary">{validation.aiReport.summary}</p>
            )}
          </div>
        )}

        {/* Threshold slider + Test button */}
        {step === 2 && validation?.attestation?.attestationUID && (
          <div className="delegate-threshold-section">
            <label htmlFor="delegate-threshold">
              Minimum Trust Score: <strong>{minScore}%</strong>
            </label>
            <input
              id="delegate-threshold"
              type="range"
              min="0"
              max="100"
              value={minScore}
              onChange={(e) => setMinScore(parseInt(e.target.value))}
              className="delegate-slider"
            />
            <div className="delegate-slider-labels">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
            <button
              className="delegate-btn delegate-btn--test"
              onClick={handleTestDelegation}
            >
              Step 2 -- Test Delegation
            </button>
          </div>
        )}

        {/* Testing spinner */}
        {step === 3 && (
          <Spinner message="TrustEnforcer is checking the attestation on-chain..." />
        )}

        {/* Step 4: Delegation Result */}
        {step === 4 && delegationResult && (
          <div className={`delegate-result ${delegationResult.approved ? "delegate-result--approved" : "delegate-result--blocked"}`}>
            <div className="delegate-result-header">
              <span className="delegate-result-icon">
                {delegationResult.approved ? "\u2713" : "\u2717"}
              </span>
              <div className="delegate-result-text">
                <span className="delegate-result-verdict">
                  {delegationResult.approved ? "DELEGATION APPROVED" : "DELEGATION BLOCKED"}
                </span>
                {delegationResult.approved ? (
                  <span className="delegate-result-detail">
                    Trust score {delegationResult.trustScore}% meets the minimum threshold of {delegationResult.minRequired}%
                  </span>
                ) : (
                  <span className="delegate-result-detail">
                    {delegationResult.details || delegationResult.reason}
                  </span>
                )}
              </div>
            </div>

            {/* On-chain proof links */}
            {delegationResult.proof && (
              <div className="delegate-proof-section">
                <h4>On-Chain Proof</h4>
                <div className="delegate-proof-links">
                  <a href={delegationResult.proof.enforcerBaseScan} target="_blank" rel="noopener">
                    TrustEnforcer Contract
                  </a>
                  <a href={delegationResult.proof.attestationEASScan} target="_blank" rel="noopener">
                    EAS Attestation
                  </a>
                  <a href={delegationResult.proof.schemaEASScan} target="_blank" rel="noopener">
                    Validation Schema
                  </a>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="delegate-result-actions">
              <button className="delegate-btn delegate-btn--secondary" onClick={handleRetestWithNewThreshold}>
                Change Threshold & Retest
              </button>
              <button className="delegate-btn delegate-btn--secondary" onClick={handleReset}>
                Start Over
              </button>
            </div>
          </div>
        )}

        {step === 4 && delegationError && (
          <div className="delegate-error">
            <p>{delegationError}</p>
          </div>
        )}

        {/* No attestation warning -- with recovery button */}
        {step === 2 && validation && !validation.attestation?.attestationUID && (
          <div className="delegate-error">
            <p>
              On-chain attestation could not be created. The delegation test requires a valid
              EAS attestation UID.
            </p>
            <button
              className="delegate-btn delegate-btn--secondary"
              onClick={() => { setStep(0); setValidation(null); }}
              style={{ marginTop: "0.75rem" }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* TrustEnforcer info */}
      <div className="delegate-info-card">
        <h3>About TrustEnforcer</h3>
        <p>
          TrustEnforcer is a custom caveat enforcer built for the MetaMask Delegation Framework.
          It reads EAS attestations on-chain and validates that an agent's trust score meets the
          delegator's minimum threshold before allowing any delegated action to proceed.
        </p>
        <div className="delegate-info-details">
          <div className="delegate-info-item">
            <span className="delegate-info-label">Contract</span>
            <a
              href={`https://sepolia.basescan.org/address/${TRUST_ENFORCER_ADDRESS}`}
              target="_blank"
              rel="noopener"
              className="delegate-info-value delegate-info-value--link"
            >
              {TRUST_ENFORCER_ADDRESS}
            </a>
          </div>
          <div className="delegate-info-item">
            <span className="delegate-info-label">Network</span>
            <span className="delegate-info-value">Base Sepolia</span>
          </div>
          <div className="delegate-info-item">
            <span className="delegate-info-label">Framework</span>
            <span className="delegate-info-value">MetaMask Delegation Framework</span>
          </div>
        </div>
      </div>

      {/* Composable Caveats */}
      <div className="delegate-composable-card">
        <h3>Composable Caveats</h3>
        <p className="delegate-composable-intro">
          The MetaMask Delegation Framework supports stacking multiple caveat enforcers on a single
          delegation. In production, a delegator would combine TrustEnforcer with built-in framework
          enforcers to create precise, multi-layered permission controls. The DelegationManager
          validates ALL caveats before executing -- if any single caveat fails, the delegation is blocked.
        </p>

        <div className="caveat-stack">
          <div className="caveat-stack-label">Delegation Caveats</div>

          <div className="caveat-item caveat-item--custom">
            <div className="caveat-icon">TA</div>
            <div className="caveat-info">
              <span className="caveat-name">TrustEnforcer</span>
              <span className="caveat-desc">Minimum trust score required (our custom enforcer)</span>
            </div>
            <span className="caveat-badge caveat-badge--custom">Custom</span>
          </div>

          <div className="caveat-connector">+</div>

          <div className="caveat-item">
            <div className="caveat-icon">TS</div>
            <div className="caveat-info">
              <span className="caveat-name">TimestampEnforcer</span>
              <span className="caveat-desc">Delegation valid only within a time window</span>
            </div>
            <span className="caveat-badge">Built-in</span>
          </div>

          <div className="caveat-connector">+</div>

          <div className="caveat-item">
            <div className="caveat-icon">LC</div>
            <div className="caveat-info">
              <span className="caveat-name">LimitedCallsEnforcer</span>
              <span className="caveat-desc">Maximum number of redemptions allowed</span>
            </div>
            <span className="caveat-badge">Built-in</span>
          </div>

          <div className="caveat-connector">+</div>

          <div className="caveat-item">
            <div className="caveat-icon">AT</div>
            <div className="caveat-info">
              <span className="caveat-name">AllowedTargetsEnforcer</span>
              <span className="caveat-desc">Only specific contract addresses can be called</span>
            </div>
            <span className="caveat-badge">Built-in</span>
          </div>
        </div>

        <div className="caveat-example">
          <h4>Example: Production Delegation</h4>
          <pre className="caveat-code">{`{
  delegate: "0xAgentAddress",
  authority: ROOT_AUTHORITY,
  caveats: [
    {
      enforcer: "${TRUST_ENFORCER_ADDRESS}",
      terms: encodePacked(minTrustScore, schemaUID, attester)
    },
    {
      enforcer: "TimestampEnforcer",
      terms: encodePacked(startTime, endTime)
    },
    {
      enforcer: "LimitedCallsEnforcer",
      terms: encodePacked(maxCalls: 10)
    },
    {
      enforcer: "AllowedTargetsEnforcer",
      terms: encodePacked([targetContract1, targetContract2])
    }
  ]
}`}</pre>
          <p className="caveat-example-note">
            This delegation would only succeed if the agent has a valid trust score above the
            threshold, the current time is within the allowed window, the agent hasn't exceeded
            the call limit, and the target contract is in the allowlist. All checks happen on-chain.
          </p>
        </div>
      </div>
    </div>
  );
}
