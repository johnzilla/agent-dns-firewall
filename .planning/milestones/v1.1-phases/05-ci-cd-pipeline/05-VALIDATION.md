---
phase: 5
slug: ci-cd-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 (existing tests) + YAML syntax validation |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npm run check` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (verify existing tests still pass)
- **After every plan wave:** Run `npm test && npm run check`
- **Before `/gsd:verify-work`:** Full suite must be green + push to GitHub and verify Actions tab
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Req ID | Requirement | Test Type | Automated Command | File Exists | Status |
|--------|-------------|-----------|-------------------|-------------|--------|
| CI-01 | Workflow triggers on push/PR | manual-only | Push commit, check Actions tab | N/A | ⬜ pending |
| CI-02 | Tests across Node 18, 20, 22 | manual-only | Verify matrix in Actions UI | N/A | ⬜ pending |
| CI-03 | Build + publint + attw after tests | manual-only | Verify validate job in Actions UI | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Note:** CI/CD pipeline requirements are inherently manual-verification. The workflow YAML is declarative configuration, not application code. Validation requires pushing to GitHub and observing the Actions tab.

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test infrastructure needed — this phase creates CI config, not application code.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI triggers on push | CI-01 | Requires GitHub Actions execution | Push a commit, verify workflow runs in Actions tab |
| Node version matrix | CI-02 | Requires GitHub Actions matrix | Check Actions run shows 3 parallel jobs for Node 18/20/22 |
| Validate job runs after tests | CI-03 | Requires GitHub Actions job dependencies | Check validate job runs after all test jobs pass |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
