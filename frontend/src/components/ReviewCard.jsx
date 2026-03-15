import Stars from "./Stars";

export default function ReviewCard({ review, onRevoke, revoking }) {
  const { projectName, rating, reviewText, proofURI, reviewer, date, revoked, uid } = review;

  return (
    <div className={`review-card ${revoked ? "revoked" : ""}`}>
      <div className="review-card-header">
        <span className="review-project">{projectName}</span>
        {revoked && <span className="revoked-badge">Revoked</span>}
        {onRevoke && !revoked && (
          <button
            className="revoke-btn"
            onClick={() => onRevoke(uid)}
            disabled={revoking}
            title="Revoke this review on-chain"
          >
            {revoking ? "Revoking..." : "Revoke"}
          </button>
        )}
      </div>
      <Stars rating={rating} />
      <p className="review-text">{reviewText}</p>
      <div className="review-meta">
        <span>By: {reviewer.slice(0, 10)}... | {date}</span>
        <span className="review-links">
          {proofURI && (
            <a href={proofURI} target="_blank" rel="noopener" className="proof-link">
              Proof of work
            </a>
          )}
          <a
            href={`https://base-sepolia.easscan.org/attestation/view/${uid}`}
            target="_blank"
            rel="noopener"
            className="onchain-link"
            title="Verify this review independently on the blockchain"
          >
            Verify
          </a>
        </span>
      </div>
    </div>
  );
}
