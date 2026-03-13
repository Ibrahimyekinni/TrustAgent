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
