---
phase: 4
slug: package-configuration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 + publint + @arethetypeswrong/cli |
| **Config file** | vitest.config.ts (existing), package.json scripts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npm run check` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test && npm run check`
- **Before `/gsd:verify-work`:** Full suite must be green + `npm publish --dry-run` succeeds
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Req ID | Requirement | Test Type | Automated Command | File Exists | Status |
|--------|-------------|-----------|-------------------|-------------|--------|
| PKG-01 | Conditional exports with types condition first | smoke | `npm run build && attw --pack` | N/A (tool) | ⬜ pending |
| PKG-02 | Package metadata fields present | smoke | `npm pack --dry-run` | N/A (config) | ⬜ pending |
| PKG-03 | Version set to 1.0.0 | manual-only | Check package.json | N/A | ⬜ pending |
| PKG-04 | sideEffects: false | manual-only | Check package.json | N/A | ⬜ pending |
| PKG-05 | LICENSE file exists | manual-only | `test -f LICENSE` | ✅ exists | ⬜ pending |
| BUILD-01 | nodenext module/moduleResolution | smoke | `npm run build` (tsc succeeds) | N/A | ⬜ pending |
| BUILD-02 | prepublishOnly runs build+validation | smoke | `npm publish --dry-run` | N/A | ⬜ pending |
| VAL-01 | publint validates structure | smoke | `npx publint` | ❌ W0 | ⬜ pending |
| VAL-02 | attw validates types | smoke | `npx attw --pack` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install `publint` as devDependency
- [ ] Install `@arethetypeswrong/cli` as devDependency
- [ ] Add `check` script to package.json before validation commands work

*These must be done before any validation commands can execute.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Version is 1.0.0 | PKG-03 | Static config value | Inspect `version` field in package.json |
| sideEffects: false present | PKG-04 | Static config value | Inspect `sideEffects` field in package.json |
| LICENSE exists | PKG-05 | File presence | `test -f LICENSE && echo OK` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
