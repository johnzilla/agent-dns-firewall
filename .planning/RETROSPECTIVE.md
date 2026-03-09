# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Initial Release

**Shipped:** 2026-03-09
**Phases:** 3 | **Plans:** 6

### What Was Built
- Domain parsing and normalization (hosts format + domain list format)
- Set-based suffix matching with label-boundary awareness
- Allow/deny/blocklist precedence logic
- HTTP fetch module with Promise.allSettled error isolation
- createDomainFirewall factory with start/stop/refresh lifecycle
- Preset constants for StevenBlack and Hagezi blocklists
- Complete README documentation
- 111 tests with ~98% coverage

### What Worked
- Inside-out architecture (pure logic → I/O → quality) made each phase independently testable
- TDD approach caught issues early — tests written before implementation
- Zero runtime dependencies kept the build simple and fast
- Parallel wave execution in Phase 3 saved time (tests + README simultaneously)

### What Was Inefficient
- Phase 3 verifier caught a README precedence error — could have been caught by plan-checker if README content was more tightly specified

### Patterns Established
- Closure-based factory pattern for stateful library APIs
- Promise.allSettled for resilient multi-source operations
- Atomic swap for background refresh without vulnerability windows
- Optional log callback pattern (defaults to console, user-overridable)

### Key Lessons
- Label-boundary awareness is critical for suffix matching — naive substring matching creates false positives
- AbortController is essential for clean shutdown of async lifecycle objects
