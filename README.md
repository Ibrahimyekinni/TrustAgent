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

## How It Works

1. **Issues attestations** -- On-chain proof when a freelancer completes work
2. **Verifies reputation** -- Checks attestation history to produce a trust score
3. **Portable trust** -- Not locked to any single platform

## Built By Humans, For Humans

This isn't a project where the agent does everything and the human watches. The freelancer stays in control. The agent is the tool that does the on-chain work -- issuing attestations, querying reputation, interacting with smart contracts -- but the human decides what gets attested, who to trust, and when to act.

This entire project was built by two humans (one with no blockchain experience) directing an AI agent (Claude Code). The [conversation log](docs/conversationLog.md) shows exactly how that collaboration worked -- the brainstorms, the pivots, the breakthroughs.

## Tech Stack

- **Agent:** Claude Code
- **Blockchain:** Base (Ethereum L2)
- **Smart Contracts:** Solidity via Hardhat
- **Attestations:** EAS (Ethereum Attestation Service)

## Team

- **Ibrahim (yungmaster)** -- AI/automation, agent logic
- **Mercury** -- Crypto/web3, smart contracts

## Setup

```bash
npm install
npx hardhat compile
```

## Deploy (Base Sepolia Testnet)

```bash
npx hardhat run scripts/deploy.js --network baseSepolia
```

## License

MIT
