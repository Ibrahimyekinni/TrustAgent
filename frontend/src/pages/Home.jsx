import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="home-page">
      {/* Hero */}
      <section className="hero">
        <p className="header-label">On-Chain Reputation Protocol</p>
        <h1 className="hero-title">
          Trust<span className="h1-accent">Agent</span>
        </h1>
        <p className="tagline">Portable. Permanent. Trustless.</p>
        <p className="hero-description">
          Freelancer reputation that no platform can delete, modify, or lock away.
          Reviews live on the blockchain forever -- owned by you, verifiable by anyone.
        </p>
        <div className="hero-ctas">
          <Link to="/search" className="cta-btn cta-btn--primary">
            Search a Freelancer
          </Link>
          <Link to="/review" className="cta-btn cta-btn--primary">
            Leave a Review
          </Link>
        </div>
      </section>

      {/* Problem */}
      <section className="problem-section">
        <div className="glass-card">
          <h2>The Problem</h2>
          <p>
            You spend years building a 5-star reputation on Fiverr, Upwork, or any
            freelance platform. Then one day -- account suspended, platform shuts down,
            or you want to move. All those reviews? Gone. Your reputation is locked
            inside a platform you don't control.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="how-section">
        <h2>How It Works</h2>
        <div className="steps-grid">
          <div className="step-card glass-card">
            <div className="step-number">01</div>
            <h3>Complete a Project</h3>
            <p>
              Freelancer delivers work for a client. Business as usual -- nothing
              changes about how you work.
            </p>
          </div>
          <div className="step-card glass-card">
            <div className="step-number">02</div>
            <h3>Client Leaves a Review</h3>
            <p>
              The client connects their wallet and submits a review. It gets stored
              permanently on Base (Ethereum L2) using EAS attestations.
            </p>
          </div>
          <div className="step-card glass-card">
            <div className="step-number">03</div>
            <h3>Reputation Follows You</h3>
            <p>
              Your reviews are tied to your wallet, not a platform. Take them
              anywhere -- they're yours forever, verifiable by anyone on-chain.
            </p>
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="tech-section">
        <div className="glass-card">
          <h2>Built On</h2>
          <div className="tech-grid">
            <div className="tech-item">
              <span className="tech-name">EAS</span>
              <span className="tech-desc">Ethereum Attestation Service</span>
            </div>
            <div className="tech-item">
              <span className="tech-name">Base</span>
              <span className="tech-desc">Ethereum L2 by Coinbase</span>
            </div>
            <div className="tech-item">
              <span className="tech-name">MetaMask</span>
              <span className="tech-desc">Wallet connection</span>
            </div>
            <div className="tech-item">
              <span className="tech-name">React</span>
              <span className="tech-desc">Frontend framework</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA bottom */}
      <section className="bottom-cta">
        <h2>Ready to own your reputation?</h2>
        <div className="hero-ctas">
          <Link to="/search" className="cta-btn cta-btn--primary">
            Search a Freelancer
          </Link>
          <Link to="/review" className="cta-btn cta-btn--primary">
            Leave a Review
          </Link>
        </div>
      </section>
    </div>
  );
}
