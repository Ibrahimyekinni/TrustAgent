import { useState, useEffect } from "react";

function getScoreColor(score) {
  if (score >= 75) return "#5DD62C";
  if (score >= 50) return "#F5A623";
  if (score >= 30) return "#E8783A";
  return "#E84040";
}

function getLevelLabel(level) {
  const labels = {
    "High": "High Trust",
    "Moderate": "Moderate Trust",
    "Low": "Low Trust",
    "Very Low": "Very Low Trust",
    "Insufficient Data": "Insufficient Data",
  };
  return labels[level] || level;
}

export default function TrustScore({ results }) {
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
  }, [results]);

  if (!results || results.activeCount === 0) return null;

  if (loading) {
    return (
      <div className="trust-score-card">
        <div className="trust-score-header">
          <h3>Trust Analysis</h3>
          <span className="trust-badge trust-badge--loading">Analyzing...</span>
        </div>
        <p className="trust-loading-text">AI agent is evaluating on-chain trust signals...</p>
      </div>
    );
  }

  if (error || !analysis) return null;

  const { score, level, signals, aiAnalysis } = analysis;
  const color = getScoreColor(score);

  return (
    <div className="trust-score-card">
      <div className="trust-score-header">
        <h3>Trust Analysis</h3>
        <span className="trust-badge" style={{ borderColor: color, color }}>
          {getLevelLabel(level)}
        </span>
      </div>

      {/* Score ring */}
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
            <span className="trust-ring-number" style={{ color }}>{score}</span>
            <span className="trust-ring-text">/ 100</span>
          </div>
        </div>

        {/* Signal indicators */}
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
            <span className="trust-signal-value">{signals.withProof}</span>
            <span className="trust-signal-label">With Proof</span>
          </div>
          <div className="trust-signal">
            <span className={`trust-signal-value ${signals.selfReviews > 0 ? "trust-signal--warn" : ""}`}>
              {signals.selfReviews}
            </span>
            <span className="trust-signal-label">Self-Reviews</span>
          </div>
        </div>
      </div>

      {/* Flags */}
      <div className="trust-flags">
        {signals.selfReviews > 0 && (
          <div className="trust-flag trust-flag--red">
            Self-reviews detected -- {signals.selfReviews} review{signals.selfReviews > 1 ? "s" : ""} came from the freelancer's own wallet
          </div>
        )}
        {signals.burstDetected && (
          <div className="trust-flag trust-flag--red">
            Review burst detected -- multiple reviews submitted within a short timeframe
          </div>
        )}
        {signals.revocationRatio > 0.1 && (
          <div className="trust-flag trust-flag--yellow">
            {Math.round(signals.revocationRatio * 100)}% of reviews have been revoked
          </div>
        )}
        {signals.uniquenessRatio >= 0.9 && signals.activeCount >= 3 && (
          <div className="trust-flag trust-flag--green">
            All reviews from unique wallets -- strong indicator of organic feedback
          </div>
        )}
        {signals.withProof > 0 && (
          <div className="trust-flag trust-flag--green">
            {signals.withProof} review{signals.withProof > 1 ? "s" : ""} include proof of completed work
          </div>
        )}
      </div>

      {/* AI Analysis */}
      {aiAnalysis && (
        <div className="trust-ai-section">
          <div className="trust-ai-label">AI Agent Assessment</div>
          <p className="trust-ai-text">{aiAnalysis}</p>
        </div>
      )}
    </div>
  );
}
