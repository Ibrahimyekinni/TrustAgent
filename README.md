# TrustAgent

On-chain freelancer reputation system using attestations on Base.

Built for [The Synthesis Hackathon](https://synthesis.md) (March 2026) -- Track: Agents that Trust.

## The Problem

I'm a freelancer on Fiverr. I build automations for clients using tools like GoHighLevel, Manychat, HubSpot, n8n, and Make. My reputation -- my reviews, my ratings, my track record -- is everything. It's how I get new clients. It's how I charge more over time.

But here's the thing: **my reputation is locked to Fiverr.** If Fiverr bans my account, shuts down, or changes their algorithm, my entire track record vanishes overnight. Years of work, gone. I don't own my reputation -- Fiverr does.

And it's not just Fiverr. Every freelance platform works this way. Your reputation on Upwork doesn't transfer to Fiverr. Your Fiverr rep doesn't transfer to LinkedIn. You start from zero every time you join a new platform. The platforms love this because it keeps you locked in.

There's no way for a freelancer to build a portable, verifiable, platform-independent reputation. Until now.

## The Solution

TrustAgent is an AI agent (powered by Claude Code) that creates and verifies on-chain reputation attestations using EAS (Ethereum Attestation Service) on Base.

When a freelancer completes work:

1. The client (or agent) issues an attestation on-chain: "Freelancer X completed Project Y, rated 5/5"
2. That attestation is permanent, verifiable, and not controlled by any platform
3. Any new platform, client, or employer can query that freelancer's on-chain reputation
4. The freelancer owns their reputation -- it goes wherever they go

## Why This Matters

- **For freelancers:** Your reputation becomes an asset YOU own, not something a platform holds hostage
- **For clients:** You can verify a freelancer's track record across all platforms, not just the one you're on
- **For the ecosystem:** Trust becomes decentralized and portable, breaking platform lock-in

## Features

### CLI Agent (`npm run agent`)

An interactive command-line agent that handles all blockchain complexity behind simple commands:

| Command | What it does |
|---------|-------------|
| `review <address> <project> <rating> <review>` | Create an on-chain review for a freelancer |
| `reputation <address>` | See ALL reviews and average rating for a freelancer |
| `check <attestationUID>` | Look up a single review by its attestation ID |
| `revoke <attestationUID>` | Revoke a review you created (only your own) |
| `help` | Show available commands |

Key behaviors:
- **Revocation-aware scoring** -- Revoked reviews are visible (transparency) but excluded from the average rating
- **Ownership checks** -- Before revoking, the agent verifies your wallet matches the original attester. EAS enforces this at the smart contract level too, but we check client-side first for a clear error message instead of a confusing blockchain error
- **Input validation** -- Validates wallet addresses, rating bounds (1-5), and attestation UIDs before sending transactions

### Web Frontend (`frontend/`)

A zero-dependency web UI that lets anyone look up a freelancer's on-chain reputation. No server, no database, no API keys -- the browser talks directly to the EAS GraphQL API. The blockchain IS the database.

- Paste any wallet address to see their full reputation report
- Star ratings, review text, project names, and reviewer addresses
- Each review links to its on-chain proof on EASScan -- click to verify independently
- Revoked reviews are visually marked and excluded from the score
- XSS protection on all on-chain data (anyone can write anything in an attestation, including malicious JavaScript -- we sanitize before rendering)
- ABI decoding done manually in the browser instead of importing the full EAS SDK -- zero dependencies, fast load

## Architecture

```
                    ┌─────────────────────┐
                    │   Base Sepolia (L2)  │
                    │                     │
                    │  EAS Smart Contract  │
                    │  (attestations live  │
                    │   here permanently)  │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │  EAS GraphQL Indexer │
                    │  (search engine for  │
                    │   attestations)      │
                    └──────┬───────┬──────┘
                           │       │
              ┌────────────┘       └────────────┐
              │                                 │
     ┌────────┴────────┐              ┌─────────┴────────┐
     │   CLI Agent      │              │   Web Frontend    │
     │                  │              │                  │
     │  Write reviews   │              │  Read reviews    │
     │  Read reviews    │              │  (browser-only,  │
     │  Revoke reviews  │              │   no backend)    │
     │  (needs wallet)  │              │                  │
     └─────────────────┘              └──────────────────┘
```

The CLI agent needs a wallet (private key) because it writes to the blockchain. The frontend only reads, so it needs nothing -- just open the HTML file.

## On-Chain Artifacts

Everything below is live on Base Sepolia right now. Click the links to verify independently.

- **Schema:** [`0x5d6661...70ce30`](https://base-sepolia.easscan.org/schema/view/0x5d6661abb66715bfc01d1744f52f52594c1b01ed473d9facb2825988ef70ce30) -- Our review "form" registered on-chain: `address freelancer, string projectName, uint8 rating, string review`
- **Test attestation 1:** [`0x7bd386...2779`](https://base-sepolia.easscan.org/attestation/view/0x7bd386bab4474368720ae19737fd65d31cc9597cf82bd061192291437c5c2779) -- 5-star Manychat Automation review
- **Test attestation 2:** [`0x6956ff...0236`](https://base-sepolia.easscan.org/attestation/view/0x6956ffed6a2c4d02fa0e919dfc49909075e9174a206ea346a9319bcd83740236) -- 4-star GHL Automation review (created via CLI agent)

## Try It Yourself

### Web Frontend (no setup needed)

1. Open `frontend/index.html` in your browser
2. Paste the demo address: `0x12e38f09f8d39Ba1B18Ec2d158cAB0DD92D45eEa`
3. Click Search -- you'll see real reviews pulled directly from the blockchain

### CLI Agent

```bash
# 1. Install dependencies
npm install

# 2. Create a .env file with your wallet and schema
#    (see .env.example for the format)
cp .env.example .env

# 3. Run the agent
npm run agent

# 4. Try these commands:
#    reputation 0x12e38f09f8d39Ba1B18Ec2d158cAB0DD92D45eEa
#    review 0x<address> "Project Name" 5 "Great work"
#    check 0x<attestationUID>
```

## Tech Stack

| Layer | Tool | Why |
|-------|------|-----|
| Agent harness | Claude Code | Approved by hackathon, handles all code and blockchain interaction |
| Blockchain | Base (Ethereum L2) | Cheap transactions, EAS already deployed |
| Attestations | EAS (Ethereum Attestation Service) | Battle-tested, no custom contracts needed |
| Smart contract interaction | ethers.js v6 | Industry standard for Ethereum |
| Attestation encoding/decoding | @ethereum-attestation-service/eas-sdk | Schema registration and ABI encoding |
| Frontend | Vanilla HTML/CSS/JS | Zero dependencies, no build step, no backend |
| Dev tooling | Hardhat | Compilation and deployment |

## Built By Humans, For Humans

This isn't a project where the agent does everything and the human watches. The freelancer stays in control. The agent is the tool that does the on-chain work -- issuing attestations, querying reputation, interacting with smart contracts -- but the human decides what gets attested, who to trust, and when to act.

This entire project was built by two humans (one with zero blockchain experience) directing an AI agent (Claude Code). The [conversation log](docs/conversationLog.md) shows exactly how that collaboration worked -- the brainstorms, the pivots, the breakthroughs. A quiz system was used after each build phase to make sure the human understood what was being built, not just copy-pasting.

## Team

- **Ibrahim (yungmaster)** -- AI/automation expert, project vision and strategy, agent logic. Zero blockchain experience before this hackathon.
- **Mercury** -- Crypto/web3, smart contracts and blockchain guidance.
- **Claude Code** -- AI agent handling all code, blockchain interactions, and technical execution.

## License

MIT
