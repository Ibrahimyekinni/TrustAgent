# Presentation Winning Points

Key technical decisions and architecture choices that judges will notice. Use these in slides, demo walkthrough, and Q&A.

---

## 1. No Backend Needed -- The Blockchain IS the Database

The frontend talks directly to the EAS GraphQL API from the browser. No server, no database, no API keys required. Anyone can open the HTML file and query on-chain reputation data. This is what decentralization actually looks like in practice.

**Why judges care:** Most hackathon projects have a backend that could go down. Ours can't -- the data lives on Base permanently.

## 2. XSS Protection on On-Chain Data

We sanitize all review text before rendering it in the DOM using `escapeHtml()`. Since anyone can write anything in an attestation (including malicious JavaScript), we must sanitize it. This is real-world security thinking.

**Why judges care:** Shows we're thinking about production-grade concerns, not just a toy demo.

## 3. ABI Decoding in the Browser (No SDK Import)

Instead of importing the entire EAS SDK (designed for Node.js, heavy), we decode the raw attestation hex data manually in the browser using ABI decoding logic. This keeps the frontend tiny and fast -- zero dependencies.

**Why judges care:** Shows deep understanding of how attestation data is structured, not just calling library functions.

## 4. Revocation-Aware Reputation Scoring

Our reputation system doesn't just show all reviews -- it filters revoked attestations out of the average rating calculation. Revoked reviews are still visible (transparency) but marked as revoked and excluded from the score.

**Why judges care:** Shows we thought about trust and abuse from Day 1, not as an afterthought.

## 5. Only the Original Reviewer Can Revoke

Before processing a revocation, the agent checks that the current wallet matches the original attester. EAS enforces this at the smart contract level too, but we check client-side first for a better user experience (fail fast with a clear message instead of a confusing blockchain error).

**Why judges care:** Defense in depth -- client-side validation + smart contract enforcement.

## 6. Portable Reputation (The Core Story)

A freelancer's reviews aren't locked to Fiverr, Upwork, or any platform. They live on Base (Ethereum L2) and can be verified by anyone, anywhere, forever. If Fiverr shuts down tomorrow, your reputation survives.

**Why judges care:** This is the actual problem we're solving. Everything else is implementation detail.

## 7. Human-Agent Collaboration Model

yungmaster (zero blockchain experience) directed strategy and made key decisions. Claude Code (agent) handled all code, blockchain interactions, and technical execution. The quiz system ensures the human understands what's being built, not just copy-pasting.

**Why judges care:** The hackathon explicitly evaluates "meaningful agent contribution" and the human staying in control.

---

## Demo Script (suggested order)

1. Show the frontend -- paste the demo address, see the reputation report load
2. Click "View on-chain" on a review -- show it's REAL data on the blockchain
3. Switch to the CLI -- create a new review live
4. Refresh the frontend -- show the new review appears immediately
5. Revoke a review via CLI -- refresh frontend, show it's marked as revoked
6. Show the codebase -- highlight no backend, direct blockchain queries
7. Tell the story -- "I had zero blockchain experience 9 days ago"
