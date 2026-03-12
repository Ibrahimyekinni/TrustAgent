# TrustAgent

On-chain freelancer reputation system using attestations on Base.

Built for [The Synthesis Hackathon](https://synthesis.md) (March 2026) -- Track: Agents that Trust.

## What It Does

Freelancers build reputation on centralized platforms (Fiverr, Upwork, etc.) but that reputation isn't portable. TrustAgent fixes this by issuing on-chain attestations when work is completed, creating a decentralized reputation score that follows the freelancer everywhere.

1. **Issues attestations** -- On-chain proof when a freelancer completes work
2. **Verifies reputation** -- Checks attestation history to produce a trust score
3. **Portable trust** -- Not locked to any single platform

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
