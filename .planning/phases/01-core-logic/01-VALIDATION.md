---
phase: 1
slug: core-logic
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `vitest.config.ts` (Wave 0 — needs creation) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | — | setup | `npx vitest run` | No — W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | PARSE-01 | unit | `npx vitest run tests/parse.test.ts -t "hosts"` | No — W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | PARSE-02 | unit | `npx vitest run tests/parse.test.ts -t "domain-list"` | No — W0 | ⬜ pending |
| 1-02-03 | 02 | 1 | PARSE-04 | unit | `npx vitest run tests/normalize.test.ts` | No — W0 | ⬜ pending |
| 1-02-04 | 02 | 1 | MATCH-01, MATCH-02 | unit | `npx vitest run tests/match.test.ts` | No — W0 | ⬜ pending |
| 1-02-05 | 02 | 1 | MATCH-03, OVER-01, OVER-02, OVER-03 | unit | `npx vitest run tests/decide.test.ts` | No — W0 | ⬜ pending |
| 1-02-06 | 02 | 1 | RESL-02 | unit | `npx vitest run tests/decide.test.ts -t "resilience"` | No — W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — project initialization with `"type": "module"`, vitest dev dependency
- [ ] `tsconfig.json` — TypeScript config targeting ES2020
- [ ] `vitest.config.ts` — Vitest configuration

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
