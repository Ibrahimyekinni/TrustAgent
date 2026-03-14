# TrustAgent Backlog

Issues and improvements discovered during building. Completed items are marked with checkmarks.

---

## Completed (V1)

### 1. Reputation Command (Look up ALL reviews for a freelancer) -- DONE

Implemented `reputation <address>` command in the CLI agent. Queries EAS GraphQL API for all attestations matching our schema for a given wallet address. Displays total reviews, average rating, and individual review details. Also implemented in the frontend.

**Completed:** Day 2 (March 14, 2026)

---

### 2. Revocation (Handle bad/fake reviews) -- DONE

Implemented `revoke <attestationUID>` command. Only the original attester can revoke. Revoked reviews are still visible in reputation lookups but marked as revoked and excluded from the average rating calculation. Both CLI and frontend handle revocation display.

**Completed:** Day 2 (March 14, 2026)

---

### 5. Frontend (Web UI) -- DONE

Built a zero-dependency frontend that queries the EAS GraphQL API directly from the browser. No backend needed. Features: wallet address search, star ratings, individual review cards, on-chain verification links, revocation-aware display. Glassmorphism design with neon green palette.

**Completed:** Day 2 (March 14, 2026)

---

## Up Next

### 3. Proof of Work in Schema (Verify work was actually done)

**Problem:** Right now, anyone can review anyone. There's no proof that the reviewer actually hired the freelancer or that work was completed. This makes fake reviews easy.

**What we could do:**
- Add a `bytes32 proofHash` field to our schema -- a hash of some proof (invoice, contract, delivery confirmation)
- Or add a `string proofURI` field pointing to off-chain evidence (IPFS link, etc.)
- This would require registering a NEW schema (can't modify existing ones)

**Status:** Planned for Day 3+

---

### 4. Smarter Input Parsing (Natural language)

**Problem:** The agent requires exact command syntax like `review 0x1234... "Project" 5 "Great work"`. Real users would rather type something like "leave a 5 star review for 0x1234 on the Logo Design project, they did great work."

**What we could do:**
- Add basic natural language parsing to extract intent and parameters from plain English
- Or integrate with Claude API for actual NLP understanding

**Status:** Planned for Day 3+

---

## Filed During: Day 1 Build (March 13, 2026)
## Updated: Day 2 (March 14, 2026)
