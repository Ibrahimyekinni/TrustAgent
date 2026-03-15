import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="home-page">
      {/* Hero */}
      <section className="hero">
        <p className="header-label">Agent Trust Protocol</p>
        <h1 className="hero-title">
          Trust<span className="h1-accent">Agent</span>
        </h1>
        <p className="tagline">Portable. Permanent. Trustless.</p>
        <p className="hero-description">
          How do you trust something without a face? TrustAgent builds verifiable
          on-chain reputation for agents, services, and humans -- using EAS attestations
          and ERC-8004 identity. No centralized registry can revoke it.
        </p>
        <div className="hero-ctas">
          <Link to="/agents" className="cta-btn cta-btn--primary">
            Explore Agent Registry
          </Link>
          <Link to="/search" className="cta-btn cta-btn--secondary">
            Search Reputation
          </Link>
        </div>
      </section>

      {/* Problem */}
      <section className="problem-section">
        <div className="glass-card">
          <h2>The Problem</h2>
          <p>
            Your agent interacts with other agents and services, but trust flows through
            centralized registries and API key providers. If that provider revokes access
            or shuts down, you lose the ability to use the service you depended on.
          </p>
          <p style={{ marginTop: "1rem" }}>
            The same problem hits humans: you spend years building a 5-star reputation on
            Fiverr or Upwork, then one day -- account suspended, platform shuts down. All
            those reviews? Gone. Your reputation is locked inside a platform you don't control.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="how-section">
        <h2>How It Works</h2>
        <div className="steps-grid">
          <div className="step-card glass-card">
            <div className="step-number">01</div>
            <h3>Register Identity</h3>
            <p>
              An agent or human registers on-chain via ERC-8004, creating a verifiable
              identity anchored to Ethereum. No centralized authority needed.
            </p>
          </div>
          <div className="step-card glass-card">
            <div className="step-number">02</div>
            <h3>Build Reputation</h3>
            <p>
              Complete work, receive attestations and feedback on-chain. Every interaction
              builds a permanent, tamper-proof track record via EAS and the ERC-8004
              Reputation Registry.
            </p>
          </div>
          <div className="step-card glass-card">
            <div className="step-number">03</div>
            <h3>Trust is Portable</h3>
            <p>
              Any agent or service can query on-chain reputation before deciding to interact.
              An AI trust agent analyzes the data, detects manipulation, and delivers a verdict.
            </p>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="use-cases-section">
        <h2>Use Cases</h2>
        <div className="steps-grid">
          <div className="glass-card use-case-card">
            <h3>Agent-to-Agent Trust</h3>
            <p>
              Before delegating work to another agent, check its on-chain reputation.
              Verify identity, analyze feedback patterns, and detect sybil attacks --
              all without trusting a centralized registry.
            </p>
          </div>
          <div className="glass-card use-case-card">
            <h3>Freelancer Reputation</h3>
            <p>
              Freelancers build portable reputation through client reviews stored as
              EAS attestations. Take your track record anywhere -- no platform can
              delete or modify it.
            </p>
          </div>
          <div className="glass-card use-case-card">
            <h3>Service Discovery</h3>
            <p>
              Browse the ERC-8004 Agent Registry to find trusted services. Each agent's
              identity, capabilities, and reputation are verifiable on-chain.
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
              <span className="tech-name">ERC-8004</span>
              <span className="tech-desc">Agent Identity & Reputation</span>
            </div>
            <div className="tech-item">
              <span className="tech-name">EAS</span>
              <span className="tech-desc">Ethereum Attestation Service</span>
            </div>
            <div className="tech-item">
              <span className="tech-name">Base</span>
              <span className="tech-desc">Ethereum L2 by Coinbase</span>
            </div>
            <div className="tech-item">
              <span className="tech-name">Claude</span>
              <span className="tech-desc">AI Trust Analysis Agent</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA bottom */}
      <section className="bottom-cta">
        <h2>Verify trust, not promises.</h2>
        <div className="hero-ctas">
          <Link to="/agents" className="cta-btn cta-btn--primary">
            Explore Agent Registry
          </Link>
          <Link to="/search" className="cta-btn cta-btn--secondary">
            Search Reputation
          </Link>
          <Link to="/review" className="cta-btn cta-btn--secondary">
            Leave a Review
          </Link>
        </div>
      </section>
    </div>
  );
}
