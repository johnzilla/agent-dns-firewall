# Project Research Summary

**Project:** agent-dns-firewall
**Domain:** In-process DNS blocklist / hostname egress guard for AI agents
**Researched:** 2026-03-08
**Confidence:** MEDIUM

## Executive Summary

This project is an in-process domain firewall library -- not a DNS server, not a proxy, not a browser extension. It answers one question: "should this hostname be blocked?" Experts in this space (Pi-hole, AdGuard Home, uBlock Origin) all follow the same fundamental pipeline: fetch blocklists, parse them, normalize domains, index them in a fast-lookup structure, and check queries against that index with allow/deny overrides. The key architectural insight is that ingestion is slow and infrequent while lookup is fast and frequent -- all design decisions flow from this asymmetry.

The recommended approach is to build a zero-runtime-dependency TypeScript library using a `Set<string>` with suffix walking for domain matching. This is simpler than a trie, fast enough for the target scale of 150K-200K domains (sub-millisecond lookups), and avoids premature optimization. The library uses a factory pattern (`createDomainFirewall()`) that returns an independent instance with a clean start/stop lifecycle. Dev tooling is minimal: TypeScript, tsup for building, vitest for testing, Biome for linting. The entire runtime ships with zero `node_modules`.

The primary risks are: (1) hosts file parsing is messier than it looks -- real-world files contain inline comments, mixed line endings, multi-domain lines, and special entries that naive parsers miss; (2) suffix matching done wrong blocks too much or too little (the `endsWith` trap); (3) refresh race conditions can create windows where the firewall blocks nothing. All three are well-understood problems with known solutions documented in the pitfalls research. The mitigation strategy is to build from the inside out -- get normalization, parsing, and matching rock-solid with comprehensive tests before adding I/O, lifecycle, and refresh logic.

## Key Findings

### Recommended Stack

Zero runtime dependencies is the defining constraint. The entire stack is dev tooling. TypeScript with strict mode provides type safety for domain-handling edge cases. tsup bundles to a single ESM entry point with `.d.ts` generation. vitest handles testing with native ESM and TypeScript support (no Jest ESM pain). Biome replaces ESLint + Prettier as a single lint/format tool.

**Core technologies:**
- **TypeScript ~5.7**: Type safety and API contracts -- strict mode catches domain-handling bugs at compile time
- **Node.js >=18**: Global `fetch()`, `AbortController`, stable ESM -- no polyfills needed
- **tsup ~8.x**: Single-command ESM library bundling with `.d.ts` generation
- **vitest ~3.x**: Native ESM + TypeScript testing, no configuration pain
- **Biome ~1.9+**: Lint + format in one Rust binary, replaces ESLint + Prettier
- **Set<string> with suffix walking**: Domain index -- O(1) hash lookups, 5-7 label walks per query max

### Expected Features

**Must have (table stakes):**
- Hosts-format and domain-list parsing (covers StevenBlack and Hagezi, the two dominant list formats)
- Remote list fetching via HTTP/HTTPS
- Exact match and suffix/subdomain matching
- Allow list and deny list overrides with correct precedence (allow > deny > blocklist)
- Hostname normalization (lowercase, trim, strip trailing dot)
- Graceful failure on bad sources (never crash, degrade to allow-all)
- Structured block decision return value (`{ blocked, reason, source }`)
- Programmatic start/stop lifecycle

**Should have (differentiators):**
- Periodic refresh with configurable interval
- Built-in presets for popular lists (zero-config experience)
- Multiple concurrent list sources
- Event/callback on block decisions

**Defer (v2+):**
- Adblock-filter-list format parsing (`||domain^` syntax)
- Wildcard/glob patterns in allow/deny lists
- ETag/If-Modified-Since conditional refresh
- Local file source support
- Response caching with TTL
- CIDR/IP-based blocking

### Architecture Approach

The architecture follows the universal DNS blocklist pipeline: fetch, parse, normalize, index, lookup -- with allow/deny overrides checked before the blocklist. Components are cleanly separated into single-file modules with a DAG dependency graph. The factory pattern (`createDomainFirewall()`) creates closures with no shared mutable state, enabling multiple independent instances. The atomic swap pattern on refresh (build new Set, replace reference) eliminates race conditions without locks.

**Major components:**
1. **Domain Normalizer** -- lowercase, trim, strip trailing dot, validate hostname shape; used by both ingestion and lookup
2. **List Parser** -- format-aware parsing (hosts-format and domains-format) into domain arrays
3. **Domain Index** -- `Set<string>` storing all blocked domains with suffix walking for subdomain matching
4. **Lookup Engine** -- orchestrates precedence chain: allow > deny > blocklist > not-blocked
5. **List Fetcher** -- HTTP(S) download with error handling, timeouts, content validation
6. **Factory** -- wires components, manages lifecycle (start/stop), owns the refresh scheduler
7. **Presets** -- named config objects with pre-filled URLs for popular lists

### Critical Pitfalls

1. **Hosts file format is messier than expected** -- real files have inline comments, `\r\n` mixed with `\n`, tabs as separators, multi-domain lines, and special entries like `localhost`. Prevention: split on any whitespace, strip inline comments, handle both line ending styles, skip special entries, test with real StevenBlack/Hagezi files.

2. **Suffix matching false positives** -- `"notexample.com".endsWith("example.com")` is true but `notexample.com` is not a subdomain of `example.com`. Prevention: check exact match OR `hostname.endsWith("." + blocked)`. Always verify at label boundaries.

3. **Refresh race conditions** -- clearing the blocklist before new data loads creates a vulnerability window. Prevention: build a new Set, then atomically swap the reference. Never mutate the active blocklist during refresh.

4. **Silent fetch failures** -- a 200 response with an HTML error page gets parsed as garbage domain entries. Prevention: validate response content, log failures clearly, keep previous good data on refresh failure, set fetch timeouts.

5. **Timer leaks on stop** -- `setInterval` for refresh keeps the process alive after `stop()`. Prevention: store interval ID, `clearInterval` in `stop()`, call `.unref()` on the timer, cancel in-flight fetches with `AbortController`.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Core Data Structures and Matching

**Rationale:** Everything depends on correct normalization and matching. These are pure functions with no I/O -- easiest to build, test, and get right. Both ARCHITECTURE.md and FEATURES.md identify normalization as foundational.
**Delivers:** Domain normalizer, hosts-format parser, domains-format parser, Set-based domain index with suffix matching, TypeScript types (`BlockDecision`, `FirewallConfig`, `Source`)
**Addresses:** Hostname normalization, hosts-format parsing, domain-list parsing, exact match lookup, suffix/subdomain matching
**Avoids:** Pitfall 1 (messy hosts format), Pitfall 2 (suffix false positives), Pitfall 7 (inconsistent normalization), Pitfall 10 (format differences)

### Phase 2: Lookup Engine and Override Logic

**Rationale:** The lookup engine is the core value proposition. It depends on the domain index from Phase 1. Allow/deny overrides make the library usable in production (false positives are inevitable without allow lists).
**Delivers:** Lookup engine with precedence chain, allow list and deny list support, structured block decision return values
**Addresses:** Allow/deny list overrides, correct precedence order, structured block decision
**Avoids:** Pitfall 3 (TLD over-blocking -- allow-first precedence is the mitigation), Pitfall 9 (unsafe input -- define the no-throw contract here)

### Phase 3: Fetching, Configuration, and Public API

**Rationale:** Adds I/O layer on top of the tested core. The factory wires everything together and produces the public API surface. This is where the library becomes usable end-to-end.
**Delivers:** HTTP(S) list fetcher with error handling, config validator, `createDomainFirewall()` factory function, public API (`start()`, `stop()`, `isDomainBlocked()`), graceful failure on bad sources
**Addresses:** Remote list fetching, graceful failure, programmatic start/stop lifecycle, multiple concurrent list sources
**Avoids:** Pitfall 5 (silent fetch failures), Pitfall 4 (memory -- deduplicate across lists into single Set)

### Phase 4: Refresh, Presets, and Production Hardening

**Rationale:** Lifecycle management and zero-config experience. Depends on the fetcher and factory from Phase 3. Presets are just config objects but they complete the "works out of the box" story.
**Delivers:** Periodic refresh with atomic swap, built-in presets (StevenBlack, Hagezi), timer cleanup on stop, AbortController integration
**Addresses:** Periodic refresh, built-in presets, event callbacks (optional)
**Avoids:** Pitfall 6 (refresh race conditions -- atomic swap), Pitfall 8 (timer leaks -- unref + clearInterval), Pitfall 12 (stale preset URLs -- graceful degradation)

### Phase Ordering Rationale

- **Inside-out build order:** Pure functions first (normalizer, parser, index), then orchestration (lookup engine), then I/O (fetcher, factory), then lifecycle (refresh, presets). Each phase depends only on the previous one.
- **Correctness before convenience:** Matching logic must be bulletproof before adding network I/O. A fetch bug is recoverable; a matching bug silently blocks or allows the wrong domains.
- **Pitfall alignment:** The most critical pitfalls (1, 2, 7) are addressed in Phase 1 where they can be caught early with comprehensive unit tests. Race conditions (Pitfall 6) are isolated to Phase 4 where the atomic swap pattern is straightforward.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Worth verifying real StevenBlack and Hagezi file formats against live downloads during implementation. The parser edge cases (Pitfall 1) are best validated with actual data, not assumptions.
- **Phase 3:** The public API shape (`createDomainFirewall` config object, return type) deserves careful design. Look at comparable libraries (e.g., `node-cron` for lifecycle patterns) for API ergonomics.

Phases with standard patterns (skip research-phase):
- **Phase 2:** The precedence chain (allow > deny > blocklist) is a simple, well-defined pattern. No research needed.
- **Phase 4:** `setInterval` + atomic swap + `AbortController` are all standard Node.js patterns. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Versions from training data (May 2025 cutoff). Verify tsup, vitest, Biome versions before `npm install`. Core choices (TypeScript, ESM-only, zero deps) are HIGH confidence. |
| Features | MEDIUM | Based on well-established Pi-hole/AdGuard/uBlock ecosystem knowledge. The feature landscape is stable -- these tools haven't changed their core feature sets in years. |
| Architecture | HIGH | The fetch-parse-normalize-index-lookup pipeline is universal across all DNS blocklist systems. Set-based suffix walking is well-understood algorithmically. |
| Pitfalls | MEDIUM | Based on training data knowledge of real-world blocklist parsing issues. Recommend validating with live list downloads during Phase 1 implementation. |

**Overall confidence:** MEDIUM -- the domain is well-established and patterns are proven, but no live verification was possible. The main uncertainty is around specific version numbers and real-world list format edge cases.

### Gaps to Address

- **Version verification:** All dev dependency versions need verification against npm registry before installation. Run `npm view <pkg> version` for each.
- **Real list format validation:** Parsers should be validated against actual StevenBlack and Hagezi downloads during Phase 1 development, not just synthetic test data.
- **Memory benchmarking:** The 15-30 MB estimate for 200K domains in a Set is theoretical. Benchmark with `process.memoryUsage()` during Phase 1 to confirm.
- **Preset URL stability:** The specific GitHub raw URLs for StevenBlack and Hagezi presets need to be verified as current before hardcoding in Phase 4.

## Sources

### Primary (HIGH confidence)
- Hosts file format conventions -- decades-old de facto standard, unchanged
- V8 Set/Map performance characteristics -- fundamental CS + well-known engine behavior
- Node.js 18+ built-in APIs (fetch, AbortController, URL) -- stable, documented

### Secondary (MEDIUM confidence)
- Pi-hole architecture and FTL engine design -- stable, well-documented open source project
- uBlock Origin hostname trie approach -- documented in wiki and source
- StevenBlack/hosts and Hagezi list formats and conventions -- active, well-maintained projects
- tsup, vitest, Biome documentation and ecosystem positioning

### Tertiary (LOW confidence)
- Specific version numbers for dev dependencies -- training data cutoff May 2025, verify before use
- Memory estimates for large Sets -- rough calculations, need benchmarking

---
*Research completed: 2026-03-08*
*Ready for roadmap: yes*
