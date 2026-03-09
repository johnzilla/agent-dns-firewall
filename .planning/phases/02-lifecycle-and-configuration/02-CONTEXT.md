# Phase 2: Lifecycle and Configuration - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

The library can fetch remote blocklists from HTTP(S) URLs, wire everything together via a `createDomainFirewall(config)` factory API, manage its own lifecycle (start/stop), periodically refresh blocklists, and provide preset configurations for popular blocklists. Pure logic from Phase 1 is consumed; no new matching or parsing logic.

</domain>

<decisions>
## Implementation Decisions

### Fetch error handling
- Always start successfully, even if some or all sources fail to fetch
- No retry logic — fail immediately on network error, log warning, move to next source
- If all sources fail (zero data), isDomainBlocked() still works — returns not-blocked (deny list still honored)
- isDomainBlocked() works before start() is called — returns not-blocked (no data loaded yet)
- Consistent with Phase 1's "never throws" contract

### Refresh strategy
- Atomic swap: fetch all sources into a new index, then replace old index in a single assignment
- No vulnerability window during refresh (LIFE-04)
- On refresh failure, keep serving from last successful load (stale > none)
- stop() uses AbortController to cancel in-flight HTTP requests — clean shutdown, no dangling promises
- start() is idempotent — calling again re-fetches everything and resets refresh timers

### Logging approach
- Optional `log` callback in config: `(level: 'warn' | 'error', message: string) => void`
- Defaults to console.warn/console.error if no callback provided
- Two levels only: 'warn' (degraded operation, failed source) and 'error' (critical issues)
- Only log failures — successful refreshes are silent
- Log messages include source ID and error details (e.g., "Failed to fetch source 'stevenblack': 503 Service Unavailable")

### Preset design
- Exported constants: `PRESET_STEVENBLACK_UNIFIED` and `PRESET_HAGEZI_LIGHT`
- Each preset is a complete `BlocklistSource` object with id, url, and format pre-configured
- Users compose via array spread: `sources: [PRESET_STEVENBLACK_UNIFIED, ...custom]`
- No convenience wrappers or zero-config defaults — factory + presets is the API

### Claude's Discretion
- Internal fetch implementation details (timeout values, response validation)
- How to structure the factory function internals (closure vs class)
- Refresh timer implementation (setInterval vs setTimeout chain)
- Whether to add `log` to `FirewallConfig` type or extend it

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `types.ts`: `FirewallConfig`, `DomainFirewall`, `BlocklistSource`, `BlockDecision` already defined
- `parseHostsFormat(content)` and `parseDomainList(content)`: accept string, return string[] — factory needs to fetch content then pass to these
- `buildDomainIndex(domains)`: creates Set<string> from domain arrays — used to build blocklist index
- `isDomainBlocked(input, allowSet, denySet, blocklistEntries)`: core decision function — factory wires sets and entries
- `sanitizeInput(input)`: extracts and normalizes hostname from various input formats
- `normalizeDomain(raw)`: lowercase, trim, strip trailing dot

### Established Patterns
- Pure functions with no side effects (Phase 1 convention)
- ESM-only with `.js` extension imports
- Vitest for testing
- `Set<string>` for domain indices with suffix walking via `isDomainInIndex`

### Integration Points
- `src/index.ts` re-exports everything — factory and presets will be added here
- `FirewallConfig` type may need `log` callback field added
- Factory function creates the bridge between config → fetch → parse → match → decide pipeline

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-lifecycle-and-configuration*
*Context gathered: 2026-03-08*
