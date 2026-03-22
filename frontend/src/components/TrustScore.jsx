import { useState, useEffect } from "react";

function getScoreColor(score) {
  if (score >= 75) return "#5DD62C";
  if (score >= 50) return "#F5A623";
  if (score >= 30) return "#E8783A";
  return "#E84040";
}

function getVerdictStyle(verdict) {
  const styles = {
    TRUSTWORTHY: { color: "#5DD62C", icon: "PASS", bg: "rgba(93, 214, 44, 0.08)" },
    CAUTIOUS: { color: "#F5A623", icon: "WARN", bg: "rgba(245, 166, 35, 0.08)" },
    SUSPICIOUS: { color: "#E8783A", icon: "ALERT", bg: "rgba(232, 120, 58, 0.08)" },
    UNRELIABLE: { color: "#E84040", icon: "FAIL", bg: "rgba(232, 64, 64, 0.08)" },
  };
  return styles[verdict] || styles.CAUTIOUS;
}

function getLevelLabel(level) {
  const labels = {
    High: "High Trust",
    Moderate: "Moderate Trust",
    Low: "Low Trust",
    "Very Low": "Very Low Trust",
    "Insufficient Data": "Insufficient Data",
  };
  return labels[level] || level;
}

export default function TrustScore({ results, erc8004Data }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!results || results.activeCount === 0) return;

    setLoading(true);
    setError(false);
    setAnalysis(null);

    fetch("/api/trust-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviews: results.reviews,
        activeCount: results.activeCount,
        revokedCount: results.revokedCount,
        avgRating: results.avgRating,
        address: results.address,
        erc8004Data: erc8004Data || undefined,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => {
        setAnalysis(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [results, erc8004Data]);

  if (!results || results.activeCount === 0) return null;

  if (loading) {
    return (
      <div className="trust-score-card">
        <div className="trust-score-header">
          <h3>Trust Investigation</h3>
          <span className="trust-badge trust-badge--loading">Investigating...</span>
        </div>
        <p className="trust-loading-text">Agent is analyzing reviewer credibility, detecting collusion patterns, validating proof links, and flagging suspicious reviews...</p>
      </div>
    );
  }

  if (error || !analysis) return null;

  const { score, level, signals, report, reviewFlags, collusionData } = analysis;
  const color = getScoreColor(score);
  const flaggedReviews = reviewFlags ? reviewFlags.filter((r) => r.flags.length > 0) : [];

  return (
    <div className="trust-score-card">
      {/* Header */}
      <div className="trust-score-header">
        <h3>Trust Investigation</h3>
        <span className="trust-badge" style={{ borderColor: color, color }}>
          {getLevelLabel(level)}
        </span>
      </div>

      {/* Score + Verdict */}
      <div className="trust-score-visual">
        <div className="trust-ring" style={{ "--score-color": color }}>
          <svg viewBox="0 0 120 120" className="trust-ring-svg">
            <circle cx="60" cy="60" r="52" className="trust-ring-bg" />
            <circle
              cx="60" cy="60" r="52"
              className="trust-ring-fill"
              style={{
                strokeDasharray: `${(score / 100) * 327} 327`,
                stroke: color,
              }}
            />
          </svg>
          <div className="trust-ring-label">
            <span className="trust-ring-number" style={{ color }}>{score}%</span>
          </div>
        </div>

        {/* Signal grid */}
        <div className="trust-signals">
          <div className="trust-signal">
            <span className="trust-signal-value">{signals.uniqueReviewers}</span>
            <span className="trust-signal-label">Unique Reviewers</span>
          </div>
          <div className="trust-signal">
            <span className="trust-signal-value">{signals.timeSpreadDays}d</span>
            <span className="trust-signal-label">Time Spread</span>
          </div>
          <div className="trust-signal">
            <span className="trust-signal-value">
              {signals.reviewersWithReputation}/{signals.uniqueReviewers}
            </span>
            <span className="trust-signal-label">Verified Reviewers</span>
          </div>
          <div className="trust-signal">
            <span className="trust-signal-value">
              {signals.proofsValid}/{signals.withProof || 0}
            </span>
            <span className="trust-signal-label">Valid Proofs</span>
          </div>
        </div>
      </div>

      {/* Quantitative Flags */}
      <div className="trust-flags">
        {signals.burstDetected && (
          <div className="trust-flag trust-flag--red">
            Review burst detected -- multiple reviews submitted within a short timeframe
          </div>
        )}
        {signals.duplicateReviewers > 0 && (
          <div className="trust-flag trust-flag--red">
            {signals.duplicateReviewers} wallet{signals.duplicateReviewers > 1 ? "s" : ""} submitted multiple reviews -- possible manipulation
          </div>
        )}
        {signals.coordinatedReviews > 0 && (
          <div className="trust-flag trust-flag--red">
            Coordinated activity: {signals.coordinatedReviews} pair{signals.coordinatedReviews > 1 ? "s" : ""} of reviews submitted on the same day
          </div>
        )}
        {signals.proofsInvalid > 0 && (
          <div className="trust-flag trust-flag--yellow">
            {signals.proofsInvalid} proof link{signals.proofsInvalid > 1 ? "s are" : " is"} broken or inaccessible
          </div>
        )}
        {signals.revocationRatio > 0.1 && (
          <div className="trust-flag trust-flag--yellow">
            {Math.round(signals.revocationRatio * 100)}% of reviews have been revoked
          </div>
        )}
        {signals.reviewersWithoutReputation === signals.uniqueReviewers && signals.uniqueReviewers > 1 && (
          <div className="trust-flag trust-flag--yellow">
            All reviewers are fresh wallets with no on-chain reputation of their own
          </div>
        )}
        {signals.uniquenessRatio >= 0.9 && signals.activeCount >= 3 && (
          <div className="trust-flag trust-flag--green">
            All reviews from unique wallets -- strong indicator of organic feedback
          </div>
        )}
        {signals.reviewersWithReputation > 0 && (
          <div className="trust-flag trust-flag--green">
            {signals.reviewersWithReputation} reviewer{signals.reviewersWithReputation > 1 ? "s have" : " has"} verified on-chain reputation
          </div>
        )}
        {signals.proofsValid > 0 && (
          <div className="trust-flag trust-flag--green">
            {signals.proofsValid} proof link{signals.proofsValid > 1 ? "s" : ""} verified accessible
          </div>
        )}
        {signals.hasRegisteredIdentity && (
          <div className="trust-flag trust-flag--green">
            Registered ERC-8004 agent identity -- verified on-chain
          </div>
        )}
        {signals.hasMultiSourceData && (
          <div className="trust-flag trust-flag--green">
            Multi-source reputation: data from both EAS attestations and ERC-8004 Reputation Registry
          </div>
        )}
        {signals.erc8004FeedbackCount > 0 && (
          <div className="trust-flag trust-flag--green">
            {signals.erc8004FeedbackCount} feedback entries in the ERC-8004 Reputation Registry (avg score: {signals.erc8004AvgScore})
          </div>
        )}
      </div>

      {/* AI Investigation Report */}
      {report && (
        <div className="trust-report">
          <div className="trust-report-header">
            <div className="trust-report-title">AI Agent Investigation Report</div>
            <div
              className="trust-verdict-badge"
              style={{
                color: getVerdictStyle(report.verdict).color,
                borderColor: getVerdictStyle(report.verdict).color,
                background: getVerdictStyle(report.verdict).bg,
              }}
            >
              {getVerdictStyle(report.verdict).icon}: {report.verdict}
            </div>
          </div>

          {/* Summary */}
          <div className="trust-report-section">
            <p className="trust-report-summary">{report.summary}</p>
          </div>

          {/* Credibility Factors */}
          {report.credibilityFactors && report.credibilityFactors.length > 0 && (
            <div className="trust-report-section">
              <div className="trust-report-section-title trust-report-section-title--green">Credibility Factors</div>
              <ul className="trust-report-list trust-report-list--green">
                {report.credibilityFactors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Risk Factors */}
          {report.riskFactors && report.riskFactors.length > 0 && (
            <div className="trust-report-section">
              <div className="trust-report-section-title trust-report-section-title--red">Risk Factors</div>
              <ul className="trust-report-list trust-report-list--red">
                {report.riskFactors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Flagged Reviews */}
          {report.flaggedReviews && report.flaggedReviews.length > 0 && (
            <div className="trust-report-section">
              <div className="trust-report-section-title trust-report-section-title--yellow">Flagged Reviews</div>
              <div className="trust-flagged-reviews">
                {report.flaggedReviews.map((fr, i) => (
                  <div key={i} className="trust-flagged-review">
                    <span className="trust-flagged-review-num">#{fr.index}</span>
                    <span className="trust-flagged-review-reason">{fr.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          {report.recommendation && (
            <div className="trust-report-recommendation">
              <span className="trust-report-rec-label">Recommendation</span>
              <p className="trust-report-rec-text">{report.recommendation}</p>
            </div>
          )}

          {/* Confidence */}
          {report.confidence && (
            <div className="trust-report-confidence">
              Analysis confidence: <strong>{report.confidence}</strong>
            </div>
          )}
        </div>
      )}

      {/* Flagged Individual Reviews (quantitative) */}
      {flaggedReviews.length > 0 && !report && (
        <div className="trust-report-section">
          <div className="trust-report-section-title trust-report-section-title--yellow">
            Flagged Reviews ({flaggedReviews.length}/{reviewFlags.length})
          </div>
          <div className="trust-flagged-reviews">
            {flaggedReviews.map((fr, i) => (
              <div key={i} className="trust-flagged-review">
                <span className="trust-flagged-review-num">#{fr.index}</span>
                <span className="trust-flagged-review-reason">
                  {fr.flags.join(" | ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
