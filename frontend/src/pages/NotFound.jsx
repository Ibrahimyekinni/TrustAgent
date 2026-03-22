import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <h1 className="not-found-code">404</h1>
        <h2>Page Not Found</h2>
        <p>This route doesn't exist on the trust layer.</p>
        <div className="hero-ctas" style={{ marginTop: "2rem" }}>
          <Link to="/" className="cta-btn cta-btn--primary">Go Home</Link>
          <Link to="/agents" className="cta-btn cta-btn--secondary">Browse Agents</Link>
        </div>
      </div>
    </div>
  );
}
