---
phase: 04-package-configuration
plan: 01
subsystem: infra
tags: [npm, tsconfig, nodenext, publint, attw, esm, package-publishing]

# Dependency graph
requires:
  - phase: 03-quality-and-ship
    provides: tested library with full coverage
provides:
  - npm-publishable package.json with conditional exports and metadata
  - nodenext tsconfig for proper type resolution
  - validation pipeline (publint + attw) in check script
  - prepublishOnly hook wiring build and validation
affects: [05-cicd-publishing]

# Tech tracking
tech-stack:
  added: [publint, "@arethetypeswrong/cli"]
  patterns: [esm-only conditional exports, types-first export ordering, prepublishOnly validation chain]

key-files:
  created: []
  modified: [tsconfig.json, package.json, package-lock.json]

key-decisions:
  - "Use --profile esm-only for attw since package is ESM-only (CJS warning expected and ignorable)"
  - "No main field -- conditional exports with types-first ordering only"

patterns-established:
  - "check script: build + publint + attw --pack --profile esm-only"
  - "prepublishOnly triggers full validation chain"

requirements-completed: [PKG-01, PKG-02, PKG-03, PKG-04, PKG-05, BUILD-01, BUILD-02, VAL-01, VAL-02]

# Metrics
duration: 1min
completed: 2026-03-09
---

# Phase 4 Plan 1: Package Configuration Summary

**nodenext tsconfig + full npm metadata + publint/attw validation pipeline passing all checks**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-09T15:21:40Z
- **Completed:** 2026-03-09T15:23:05Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Switched tsconfig to nodenext module/moduleResolution for proper consumer type resolution
- Added complete package.json metadata: conditional exports (types-first), version 1.0.0, keywords, repository, homepage, engines, files, sideEffects
- Installed and configured publint + attw validation tooling with prepublishOnly hook
- All 120 existing tests pass with no regression from tsconfig changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Update tsconfig.json, package.json, and install validation tooling** - `526d08a` (feat)
2. **Task 2: Validate package correctness with full check pipeline** - `d867324` (fix)

## Files Created/Modified
- `tsconfig.json` - Changed module/moduleResolution to nodenext, removed sourceMap and esModuleInterop
- `package.json` - Full npm metadata, conditional exports, check/prepublishOnly scripts, new devDependencies
- `package-lock.json` - Locked publint and @arethetypeswrong/cli

## Decisions Made
- Used `--profile esm-only` for attw to correctly handle CJS warning (expected for ESM-only package, not actionable)
- No `main` field in package.json -- conditional exports with types-first ordering is sufficient for modern consumers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added --profile esm-only to attw command**
- **Found during:** Task 2 (validation pipeline)
- **Issue:** attw --pack exited with code 1 due to CJS-resolves-to-ESM warning, which is expected for ESM-only packages
- **Fix:** Added `--profile esm-only` flag to attw in check script
- **Files modified:** package.json
- **Verification:** npm run check passes cleanly
- **Committed in:** d867324 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary fix for correct validation. The plan's check script pattern was updated to match plan intent (attw should pass).

## Issues Encountered
- `npm publish --dry-run` fails because attw --pack tries to open a .tgz that publish --dry-run doesn't persist to disk. This is an expected interaction between npm's dry-run mode and attw's pack mode. The check script works correctly when run directly via `npm run check`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Package is correctly shaped for npm publishing
- All validation tools installed and passing
- Ready for CI/CD pipeline setup in phase 05

---
*Phase: 04-package-configuration*
*Completed: 2026-03-09*
