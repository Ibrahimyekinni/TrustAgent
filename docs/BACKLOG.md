# TrustAgent Backlog

Issues and improvements discovered during building. We ship V1 first, then come back and tackle these.

---

## V2 -- Must Fix

### 1. Reputation Command (Look up ALL reviews for a freelancer)

**Problem:** Right now, the `check` command only looks up ONE review by its attestation UID (that long `0x...` string). A real user doesn't have that UID -- they want to say "show me all reviews for this freelancer" using just the freelancer's wallet address.

**What Fiverr does:** You go to a seller's profile and see ALL their reviews in one place -- average rating, individual reviews, everything.

**What we need to build:**
- A `reputation <address>` command that takes a freelancer's wallet address
- Queries EAS for ALL attestations where that address is the recipient AND the schema matches ours
- Displays: total reviews, average rating, list of individual reviews
- This requires using the EAS GraphQL API (the SDK's `getAttestation` only fetches one at a time by UID)

**Why this matters:** This is the core value prop -- portable reputation. Without this, we just have individual receipts floating around with no way to see the full picture.

---

### 2. Revocation (Handle bad/fake reviews)

**Problem:** Once a review is on-chain, it can't be deleted. If someone leaves a fake 5-star review for their friend, or a malicious 1-star review for a competitor, it stays there forever.

**What we already have:** Our attestations are created with `revocable: true`, so the EAS contract already supports revocation. We just haven't built the command for it.

**What we need to build:**
- A `revoke <attestationUID>` command that lets the ORIGINAL reviewer revoke their own review
- Only the person who created the attestation can revoke it (EAS enforces this)
- Update the `reputation` command to show revoked reviews differently (strikethrough or filtered out)
- Update the `check` command display to clearly show if a review has been revoked

**Why this matters:** Hackathon judges will ask "what about fake reviews?" -- having revocation shows we thought about trust and abuse.

---

## V2 -- Nice to Have

### 3. Proof of Work in Schema (Verify work was actually done)

**Problem:** Right now, anyone can review anyone. There's no proof that the reviewer actually hired the freelancer or that work was completed. This makes fake reviews easy.

**What we could do:**
- Add a `bytes32 proofHash` field to our schema -- a hash of some proof (invoice, contract, delivery confirmation)
- Or add a `string proofURI` field pointing to off-chain evidence (IPFS link, etc.)
- This would require registering a NEW schema (can't modify existing ones)

**Trade-off:** This adds complexity and we'd need a new schema UID. For V1/hackathon, the current schema is fine. For a real product, this would be essential. We can mention this as "future work" in our presentation.

**Decision:** Park this for now. Mention it in the README/presentation as a planned improvement. If we have time before submission, we register a V2 schema with proof fields.

---

### 4. Smarter Input Parsing (Natural language)

**Problem:** The agent requires exact command syntax like `review 0x1234... "Project" 5 "Great work"`. Real users would rather type something like "leave a 5 star review for 0x1234 on the Logo Design project, they did great work."

**What we could do:**
- Add basic natural language parsing to extract intent and parameters from plain English
- Or integrate with Claude API for actual NLP understanding

**Trade-off:** This is impressive for the demo but not core functionality. The rigid commands work fine for V1.

---

### 5. Frontend (Web UI)

**Problem:** The CLI is great for us and for the hackathon demo, but real users (clients checking a freelancer's reputation) aren't going to open a terminal.

**What we need:**
- A clean web page where you paste a freelancer's wallet address and see their full reputation
- Star ratings, individual reviews, reviewer info, dates
- Maybe a form to submit a new review (connects to MetaMask)

**Decision:** Save for last. Only build if core CLI is solid and we have time. "Everyone loves a beautiful UI" but a working CLI beats a broken frontend.

---

## Filed During: Day 1 Build (March 13, 2026)
## Source: Quiz session -- issues discovered while testing understanding of the system
