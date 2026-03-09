---
phase: 02
slug: lifecycle-and-configuration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~5 seconds |

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
| 02-01-01 | 01 | 1 | PARSE-03, RESL-01 | unit | `npx vitest run tests/fetch.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | LIFE-01, LIFE-02, LIFE-03 | unit | `npx vitest run tests/firewall.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | LIFE-04 | unit | `npx vitest run tests/refresh.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | CONF-01, CONF-02, CONF-03 | unit | `npx vitest run tests/presets.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/fetch.test.ts` — stubs for PARSE-03, RESL-01 (HTTP fetching, error handling)
- [ ] `tests/firewall.test.ts` — stubs for LIFE-01, LIFE-02, LIFE-03 (factory, start, stop)
- [ ] `tests/refresh.test.ts` — stubs for LIFE-04 (periodic refresh, atomic swap)
- [ ] `tests/presets.test.ts` — stubs for CONF-01, CONF-02, CONF-03 (preset constants, config composition)

*Existing vitest infrastructure from Phase 1 covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real HTTP fetch from StevenBlack/Hagezi | PARSE-03 | Requires network access | `npx vitest run tests/integration.test.ts` (optional, not in CI) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
