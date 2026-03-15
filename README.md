# TrustAgent

On-chain trust protocol for AI agents and freelancers. Validates agent identities, analyzes reputation across multiple sources, and records trust verdicts on the blockchain.

**Live demo:** [trustagent-app.vercel.app](https://trustagent-app.vercel.app)

Built for [The Synthesis Hackathon](https://synthesis.md) (March 2026) -- Track: Agents that Trust.

## The Problem

How do you trust something without a face?

AI agents are everywhere -- executing tasks, managing wallets, handling transactions. But there's no reliable way to verify if an agent is trustworthy before you interact with it. Centralized registries can be gamed. Self-reported credentials mean nothing. And once an agent burns you, there's no permanent record to warn others.

The same problem exists for freelancers. Your reputation on Fiverr doesn't transfer to Upwork. Your Upwork rep doesn't move to LinkedIn. Platforms own your trust, not you.

Trust should be portable, verifiable, and owned by the entity that earned it.

## The Solution

TrustAgent is an AI-powered trust protocol that combines two on-chain systems:

- **ERC-8004 (Trustless Agents)** -- The identity and reputation standard for AI agents on Base. Agents register their identity, receive feedback, and build verifiable track records.
- **EAS (Ethereum Attestation Service)** -- Permanent, on-chain attestations for reviews, validation results, and trust verdicts that no platform can delete or modify.

TrustAgent itself is a registered AI agent (Agent #1886 on Base Sepolia) that autonomously validates other agents. It reads their identity, analyzes their reputation data, runs AI-powered trust analysis, and writes the validation result on-chain as proof.

## How It Works

1. **Register Identity** -- Agents register on the ERC-8004 Identity Registry with metadata (name, description, capabilities)
2. **Build Reputation** -- Clients leave on-chain reviews via EAS attestations. Agents receive feedback through the ERC-8004 Reputation Registry
3. **Get Validated** -- TrustAgent analyzes both data sources, computes a trust score (0-100), and records the verdict on-chain
4. **Trust is Portable** -- Any agent, platform, or person can query on-chain reputation. No lock-in, no gatekeepers

## Features

### Web Frontend (4 pages)

- **Home** -- Landing page explaining the agent trust protocol
- **Search** -- Look up any wallet address to see their full reputation report with trust score analysis, star ratings, review text, and blockchain verification links. Automatically cross-references ERC-8004 agent identities
- **Leave a Review** -- Connect your wallet and submit an on-chain review as an EAS attestation. Supports proof-of-work links (GitHub, invoices, Google Drive). Revoke your own past reviews
- **Agent Registry** -- Browse and search ERC-8004 registered agents. View agent profiles with identity metadata, reputation data, and feedback. Run autonomous validation with one click

### Trust Score Engine

Deep trust analysis that goes beyond simple averages:

- **Reviewer credibility checks** -- Are reviewers real accounts or sock puppets?
- **Collusion detection** -- Are the same wallets reviewing each other?
- **Proof validation** -- Did the reviewer attach evidence of completed work?
- **ERC-8004 cross-referencing** -- Does the entity have a registered agent identity? What does their on-chain feedback look like?
- **AI investigation** -- Claude-powered analysis producing strengths, risks, and a final recommendation
- **Verdict system** -- TRUSTWORTHY / CAUTIOUS / SUSPICIOUS / UNRELIABLE with a 0-100 score

### Autonomous Agent Validation

TrustAgent (Agent #1886) validates other ERC-8004 agents:

1. Fetches agent identity from the Identity Registry
2. Fetches reputation and feedback from the Reputation Registry
3. Computes a trust score based on identity completeness, feedback quality, and data volume
4. Runs Claude AI analysis for nuanced assessment
5. Creates an on-chain EAS attestation recording the validation result permanently

### CLI Agent (`npm run agent`)

| Command | What it does |
|---------|-------------|
| `review <address> <project> <rating> <review>` | Create an on-chain review |
| `reputation <address>` | See all reviews and average rating |
| `check <attestationUID>` | Look up a single review by attestation ID |
| `revoke <attestationUID>` | Revoke a review you created |
| `help` | Show available commands |

- Claude-powered NLP for freeform input
- V1/V2 schema detection (with and without proof-of-work links)
- Revocation-aware scoring
- Ownership checks before revocation

## Architecture

```
                    ┌──────────────────────────┐
                    │     Base Sepolia (L2)     │
                    │                          │
                    │  EAS Smart Contract       │
                    │  ERC-8004 Identity Reg.   │
                    │  ERC-8004 Reputation Reg. │
                    └─────────────┬────────────┘
                                  │
                    ┌─────────────┴────────────┐
                    │   EAS GraphQL Indexer     │
                    └──────┬──────────┬────────┘
                           │          │
              ┌────────────┘          └─────────────┐
              │                                     │
     ┌────────┴────────┐               ┌────────────┴───────────┐
     │   CLI Agent      │               │   Web Frontend          │
     │                  │               │   (React + Vite)        │
     │  Write reviews   │               │                         │
     │  Read reviews    │               │  Read reviews           │
     │  Revoke reviews  │               │  Write reviews          │
     │  (private key)   │               │  Trust score analysis   │
     └─────────────────┘               │  Agent registry browse  │
                                        │  Agent validation       │
                                        │  (browser wallet)       │
                                        └─────────────────────────┘
                                                    │
                                        ┌───────────┴───────────┐
                                        │  Vercel Serverless     │
                                        │                        │
                                        │  /api/trust-score      │
                                        │  /api/agent-lookup     │
                                        │  /api/validate-agent   │
                                        └────────────────────────┘
```

## On-Chain Artifacts

Everything below is live on Base Sepolia. Click to verify independently.

### TrustAgent Identity
- **ERC-8004 Agent #1886** -- TrustAgent registered as a validator agent on the Identity Registry

### Schemas
- **V1 Review Schema:** [`0x5d6661...70ce30`](https://base-sepolia.easscan.org/schema/view/0x5d6661abb66715bfc01d1744f52f52594c1b01ed473d9facb2825988ef70ce30) -- `address freelancer, string projectName, uint8 rating, string review`
- **V2 Review Schema:** [`0xb529f1...18f1`](https://base-sepolia.easscan.org/schema/view/0xb529f19655a454738a3be1bbe2c84d69d34b19cb3ca85672b005f27db42418f1) -- Adds `string proofURI` for proof-of-work links
- **Validation Schema:** [`0xc58d7a...6b0`](https://base-sepolia.easscan.org/schema/view/0xc58d7a957517d2d26433311d878f926f4fe2ca91445186a3976d5f354206b6b0) -- `uint256 agentId, uint8 trustScore, string verdict, string reportHash`

### Sample Attestations
- **Test review (5-star):** [`0x7bd386...2779`](https://base-sepolia.easscan.org/attestation/view/0x7bd386bab4474368720ae19737fd65d31cc9597cf82bd061192291437c5c2779) -- Manychat Automation
- **Test review (4-star):** [`0x6956ff...0236`](https://base-sepolia.easscan.org/attestation/view/0x6956ffed6a2c4d02fa0e919dfc49909075e9174a206ea346a9319bcd83740236) -- GHL Automation
- **Validation attestation:** [`0x08a140...dad0`](https://base-sepolia.easscan.org/attestation/view/0x08a140aad5794147cc2b0d0f40d00e5eac4afb305aee979741aa28b899aadad0) -- TrustAgent validated Bardiel (Agent #20), score 69/100, verdict CAUTIOUS

### Demo Data
- 5 active reviews, 1 revoked, average 4.4/5 stars
- Demo address: `0x12e38f09f8d39Ba1B18Ec2d158cAB0DD92D45eEa`

## Try It Yourself

### Web Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:3000/` and try:
- Search the demo address: `0x12e38f09f8d39Ba1B18Ec2d158cAB0DD92D45eEa`
- Browse the Agent Registry
- Validate an agent

### CLI Agent

```bash
npm install
cp .env.example .env
# Fill in your .env values
npm run agent
```

## Tech Stack

| Layer | Tool | Why |
|-------|------|-----|
| Agent harness | Claude Code | Hackathon-approved, handles all code and blockchain interaction |
| Trust analysis | Claude API (Haiku) | Powers trust score engine and validation reports |
| Blockchain | Base (Ethereum L2) | Cheap transactions, EAS and ERC-8004 deployed |
| Agent identity | ERC-8004 Identity Registry | On-chain agent passports with metadata |
| Agent reputation | ERC-8004 Reputation Registry | Feedback and scoring for registered agents |
| Attestations | EAS (Ethereum Attestation Service) | Permanent on-chain reviews and validation records |
| Smart contracts | ethers.js v6 | Industry standard for Ethereum interaction |
| Frontend | React + Vite | 4-page SPA with neon glassmorphism design |
| Serverless APIs | Vercel Functions | Trust score, agent lookup, and validation endpoints |

## Human-Agent Collaboration

This project was built by a human with zero blockchain experience directing an AI agent (Claude Code). Every strategic decision was made by the human. Every line of code was written by the agent.

The [conversation log](docs/conversationLog.md) documents the full collaboration -- the brainstorms, the pivots, the breakthroughs, and the quiz sessions used to ensure the human understood what was being built.

## Team

- **Ibrahim (yungmaster)** -- AI/automation expert, project vision and strategy. Zero blockchain experience before this hackathon.
- **Claude Code** -- AI agent handling all code, blockchain interactions, and technical execution.

## License

MIT
