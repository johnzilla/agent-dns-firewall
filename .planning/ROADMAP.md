# Roadmap: agent-dns-firewall

## Overview

This roadmap delivers an in-process domain firewall library in three phases, built inside-out: pure logic first (parsing, matching, overrides), then I/O and lifecycle (fetching, factory API, refresh, presets), then quality assurance and documentation to ship. Each phase produces a coherent, testable capability that the next phase builds on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Logic** - Parsing, normalization, domain matching, and override precedence as pure functions (completed 2026-03-09)
- [ ] **Phase 2: Lifecycle and Configuration** - HTTP fetching, factory API, start/stop/refresh lifecycle, and presets
- [ ] **Phase 3: Quality and Ship** - Comprehensive tests, README, and release readiness

## Phase Details

### Phase 1: Core Logic
**Goal**: All domain parsing, normalization, matching, and override logic works correctly as pure functions with no I/O
**Depends on**: Nothing (first phase)
**Requirements**: PARSE-01, PARSE-02, PARSE-04, MATCH-01, MATCH-02, MATCH-03, OVER-01, OVER-02, OVER-03, RESL-02
**Success Criteria** (what must be TRUE):
  1. A hosts-format string (with comments, blank lines, mixed IPs) can be parsed into a clean domain list
  2. A domain-list-format string can be parsed into a clean domain list
  3. Querying a domain against a populated index returns correct exact and subdomain matches without false positives (e.g., `notmalware.test` is NOT blocked when `malware.test` is in the list)
  4. Allow/deny/blocklist precedence is correct: allowed domains are never blocked, denied domains are always blocked (after allow check), and the result includes structured `BlockDecision` fields
  5. Malformed or unexpected input to `isDomainBlocked` never throws -- returns `{ blocked: false }`
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Project setup, types, normalization, and blocklist parsers
- [ ] 01-02-PLAN.md — Domain matching index, decision logic with precedence, and public API

### Phase 2: Lifecycle and Configuration
**Goal**: The library can fetch remote blocklists, wire everything together via a factory API, and manage its own lifecycle including periodic refresh
**Depends on**: Phase 1
**Requirements**: PARSE-03, LIFE-01, LIFE-02, LIFE-03, LIFE-04, RESL-01, CONF-01, CONF-02, CONF-03
**Success Criteria** (what must be TRUE):
  1. `createDomainFirewall(config)` returns an object with `start()`, `stop()`, and `isDomainBlocked()` methods
  2. After `start()`, the firewall has fetched remote blocklists and can answer domain queries correctly
  3. If a source URL fails to fetch, the firewall logs a warning and continues operating with successfully loaded sources
  4. After `stop()`, refresh timers are cleared and no background work continues
  5. When `refreshMinutes` is configured, the firewall periodically re-fetches sources without creating a vulnerability window during refresh
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — Types update, preset constants, and HTTP fetch module with error isolation
- [ ] 02-02-PLAN.md — Factory function with lifecycle management and public API exports

### Phase 3: Quality and Ship
**Goal**: The library has comprehensive test coverage and documentation sufficient for a developer to adopt it from the README alone
**Depends on**: Phase 2
**Requirements**: QUAL-01, QUAL-02, QUAL-03, QUAL-04
**Success Criteria** (what must be TRUE):
  1. Unit tests verify hosts-format and domain-list parsing edge cases (inline comments, mixed IPs, blank lines, multi-domain lines)
  2. Unit tests verify suffix matching correctness (exact match, subdomain match, label-boundary -- no false positives)
  3. Unit tests verify allow/deny precedence logic for all combinations
  4. README contains a pitch, working quick-start example, config reference, and "what this is / isn't" section
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Logic | 2/2 | Complete   | 2026-03-09 |
| 2. Lifecycle and Configuration | 0/2 | Not started | - |
| 3. Quality and Ship | 0/? | Not started | - |
