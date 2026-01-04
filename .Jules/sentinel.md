
## 2026-01-04 - [Respect Project Boundaries]
**Learning:** Attempting to upgrade dependencies (`typescript`) in `package.json` caused a boundary violation.
**Rule:** Never modify `package.json` or `package-lock.json` unless explicitly instructed.
**Action:** Reverted `package.json` changes. Future optimizations must work within the existing dependency constraints.
