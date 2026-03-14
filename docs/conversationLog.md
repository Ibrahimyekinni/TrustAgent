# Conversation Log

Process documentation of human-agent collaboration for TrustAgent.

## March 12, 2026 -- Phase 0 Setup

### Decisions Made
- Project name: TrustAgent
- Track: Agents that Trust
- Team: Ibrahim (AI/automation) + Mercury (crypto/web3)
- Tech stack: Claude Code + Hardhat + Solidity + Base Sepolia
- Agent harness: claude-code
- Registered on-chain via Synthesis API

### Setup Completed
- MetaMask installed with Base Sepolia testnet
- Testnet ETH acquired via Superchain faucet
- Registered as hackathon participant (TrustAgent)
- GitHub repo created: https://github.com/Ibrahimyekinni/TrustAgent
- Project scaffolded with Hardhat

## March 13, 2026 -- Day 1 Build (Building starts)

### Key Decisions
- Use EAS (Ethereum Attestation Service) instead of custom smart contracts -- EAS is already deployed on Base, battle-tested, and does exactly what we need. "Use what already exists."
- Don't chase partner bounties -- focus on the open track. Only integrate a sponsor tool if it genuinely fits.
- Schema design: `address freelancer, string projectName, uint8 rating, string review` -- simple, covers the core use case.

### What We Built
1. **Installed EAS SDK + ethers.js** -- the libraries we need to talk to EAS contracts on Base
2. **registerSchema.js** -- Script that registers our "review form" on the blockchain. Only needs to run once. Schema UID: `0x5d6661abb66715bfc01d1744f52f52594c1b01ed473d9facb2825988ef70ce30`
3. **createAttestation.js** -- Script that creates an on-chain review for a freelancer
4. **getAttestation.js** -- Script that reads/verifies a review from the blockchain
5. **trustAgent.js** -- Interactive CLI agent that wraps everything into simple commands (review, check, help, exit)

### On-Chain Artifacts Created
- Schema registered on Base Sepolia: https://base-sepolia.easscan.org/schema/view/0x5d6661abb66715bfc01d1744f52f52594c1b01ed473d9facb2825988ef70ce30
- Test attestation 1 (5-star Manychat review): https://base-sepolia.easscan.org/attestation/view/0x7bd386bab4474368720ae19737fd65d31cc9597cf82bd061192291437c5c2779
- Test attestation 2 (4-star GHL review via agent CLI): https://base-sepolia.easscan.org/attestation/view/0x6956ffed6a2c4d02fa0e919dfc49909075e9174a206ea346a9319bcd83740236

### Human-Agent Collaboration Notes
- yungmaster directed the project vision and made strategic decisions (EAS over custom contracts, no bounty chasing)
- Claude Code (agent) wrote all code, handled blockchain interactions, and explained every step
- yungmaster had zero blockchain experience going in -- every concept was explained in plain terms before building
- Quiz system introduced: agent quizzes yungmaster after each build phase to ensure understanding

## March 14, 2026 -- Day 2 Build

### Key Decisions
- Build the web frontend as a zero-dependency static site -- no React, no build step, no backend. The browser talks directly to the EAS GraphQL API. This means anyone can open the HTML file and query on-chain reputation without running a server.
- Manual ABI decoding in the browser instead of importing the full EAS SDK -- keeps the frontend tiny and fast, and demonstrates understanding of how attestation data is structured on-chain.
- Final color palette: black + neon green (#0F0F0F, #202020, #5DD62C, #337418, #F8F8F8) after three design iterations. yungmaster rejected the initial dark green palette as too dark and the glassmorphism effects as too subtle.

### What We Built

#### CLI Agent Enhancements
1. **`reputation` command** -- Queries ALL reviews for a freelancer via GraphQL. Shows individual reviews, average rating, and filters revoked reviews out of the score. This is the "Fiverr profile page" equivalent.
2. **`revoke` command** -- Revokes a review the user created. Checks ownership (your wallet must match the original attester) before sending the transaction. EAS enforces this at the smart contract level too, but we check client-side first for a better error message.
3. **4 more test attestations** -- Created realistic demo data on-chain: HubSpot CRM Setup (5/5), E-commerce Chatbot (3/5), Website Redesign (5/5), Social Media Dashboard (4/5). Then revoked the E-commerce Chatbot review to demonstrate revocation. Total: 6 attestations, 5 active, 1 revoked.

#### Web Frontend
4. **index.html** -- Search interface with wallet address input, loading spinner, summary card (avatar, stats, average rating), individual review cards with star ratings, and blockchain verification links.
5. **app.js** -- Frontend logic: GraphQL queries to EAS indexer, manual ABI decoding of attestation hex data, revocation-aware scoring, XSS protection via `escapeHtml()` on all on-chain data (anyone can write anything in an attestation, including malicious JavaScript).
6. **style.css** -- Three complete rewrites:
   - v1: Dark green glassmorphism (#051F20 palette) -- rejected as too dark, glass effects invisible
   - v2: Lighter green background -- still not right
   - v3 (final): "Neon Ledger" design with black + neon green palette, glassmorphism cards with frosted glass panels, animated dot grid background, floating neon orbs, shimmer effects on buttons, card blur-in reveal animations

#### Documentation
7. **README overhaul** -- Added: features section with CLI command table, architecture diagram, on-chain artifacts with EASScan links, "Try It Yourself" section with demo address, proper tech stack table, setup instructions.
8. **presentation-notes.md** -- 7 key technical points for judges + suggested demo script.

### On-Chain Artifacts Created
- Test attestation 3 (5-star HubSpot CRM Setup)
- Test attestation 4 (3-star E-commerce Chatbot) -- later revoked to demonstrate revocation
- Test attestation 5 (5-star Website Redesign)
- Test attestation 6 (4-star Social Media Dashboard)
- Demo dataset: 5 active reviews, 1 revoked, average 4.4/5 stars

### Human-Agent Collaboration Notes
- yungmaster directed ALL design decisions -- rejected three CSS iterations with specific feedback ("too dark", "glassmorphism is weak", "change the whole palette"), provided reference screenshots (Liquid Glass Kit for glass effects, Oscillate Marketing for color palette)
- Agent handled all code: CLI enhancements, frontend HTML/CSS/JS, GraphQL integration, ABI decoding, README rewrite
- Key design tension: glassmorphism effects were invisible against similar-colored dark backgrounds. Solved by switching to high-contrast black + neon green palette where glass panels pop
- yungmaster reviewed Telegram group chats about ERC-8004 identity NFT ownership -- agent analyzed the screenshots and confirmed no immediate action needed (Devfolio holds NFTs custodially, transfer flow coming before submissions)
