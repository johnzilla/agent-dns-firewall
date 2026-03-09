---
phase: 02-lifecycle-and-configuration
plan: 01
subsystem: api
tags: [fetch, http, blocklist, presets, abort-signal]

# Dependency graph
requires:
  - phase: 01-core-logic
    provides: parseHostsFormat, parseDomainList, buildDomainIndex
provides:
  - PRESET_STEVENBLACK_UNIFIED and PRESET_HAGEZI_LIGHT blocklist source constants
  - fetchSource function for single-source HTTP fetch with format-aware parsing
  - fetchAllSources function for parallel fetch with error isolation
  - FirewallConfig log callback type
affects: [02-lifecycle-and-configuration]

# Tech tracking
tech-stack:
  added: []
  patterns: [Promise.allSettled for error isolation, AbortSignal.any for combined timeout]

key-files:
  created: [src/presets.ts, src/fetch.ts, tests/presets.test.ts, tests/fetch.test.ts]
  modified: [src/types.ts]

key-decisions:
  - "AbortSignal.any combines caller signal with 30s timeout for fetch calls"
  - "Promise.allSettled ensures individual source failures never block other sources"

patterns-established:
  - "Error isolation: log warnings for recoverable failures, never throw from aggregate operations"
  - "Format routing: source.format field determines parser selection"

requirements-completed: [PARSE-03, RESL-01, CONF-01, CONF-02, CONF-03]

# Metrics
duration: 2min
completed: 2026-03-09
---

# Phase 2 Plan 1: Presets and Fetch Summary

**Preset blocklist constants and HTTP fetch module with Promise.allSettled error isolation and AbortSignal timeout**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T01:41:21Z
- **Completed:** 2026-03-09T01:43:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Two preset blocklist source constants (StevenBlack hosts, Hagezi light domains) with correct URLs and formats
- fetchSource with combined AbortSignal timeout and format-aware parsing
- fetchAllSources with Promise.allSettled for parallel fetch, warning logs for failures, graceful degradation

## Task Commits

Each task was committed atomically:

1. **Task 1: Types update and preset constants** - `c522f1c` (feat)
2. **Task 2: HTTP fetch module with error isolation** - `1375f67` (feat)

_Note: TDD tasks - tests written first (RED), then implementation (GREEN)_

## Files Created/Modified
- `src/types.ts` - Added optional log callback to FirewallConfig
- `src/presets.ts` - PRESET_STEVENBLACK_UNIFIED and PRESET_HAGEZI_LIGHT constants
- `src/fetch.ts` - fetchSource and fetchAllSources functions
- `tests/presets.test.ts` - 10 tests for preset shapes, values, and log callback type
- `tests/fetch.test.ts` - 8 tests for fetch success, failure, mixed scenarios, and signal passing

## Decisions Made
- Used AbortSignal.any to combine caller signal with 30s timeout per fetch
- Used Promise.allSettled for parallel fetch so individual failures are isolated
- Log callback uses 'warn' level for recoverable fetch failures

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Vitest 4 uses `--bail 1` instead of `-x` flag - adjusted test commands accordingly

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Presets and fetch module ready for Plan 02 (factory function)
- fetchAllSources integrates with buildDomainIndex, returning Set-based indexes ready for isDomainInIndex

---
*Phase: 02-lifecycle-and-configuration*
*Completed: 2026-03-09*
