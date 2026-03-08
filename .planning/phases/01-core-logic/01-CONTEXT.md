# Phase 1: Core Logic - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

All domain parsing, normalization, matching, and override logic as pure functions with no I/O. This phase builds the internal engine — parsers for hosts/domains formats, a domain index with suffix matching, and the allow/deny/blocklist precedence chain. No HTTP fetching, no lifecycle management, no timers.

</domain>

<decisions>
## Implementation Decisions

### Allow/deny matching
- Allow and deny lists use **exact match only** — no suffix matching
- If `google.com` is in the allow list, `ads.google.com` is NOT allowed (must be explicitly listed)
- Same for deny: `evil.com` in deny does not block `sub.evil.com`
- This is intentionally different from blocklist matching (which uses suffix matching)

### Block decision fields
- When blocked by deny list: `reason = "custom-deny"`, `listId = undefined`
- When blocked by blocklist: `reason = "blocklist"`, `listId = source.id` (e.g., "stevenblack-unified")
- When not blocked: `blocked = false`, no reason or listId needed

### Hosts format parsing
- Take **all** non-IP tokens from each line (not just the last) — handles multi-domain lines
- Strip inline comments: split on `#`, take the part before it, then parse
- Filter known special hostnames: localhost, broadcasthost, local, ip6-localhost, ip6-loopback, and similar
- Handle both `\n` and `\r\n` line endings

### Input sanitization (isDomainBlocked)
- If a full URL is passed (`https://evil.com/path`), extract the hostname and check that
- If hostname includes a port (`evil.com:8080`), strip the port before checking
- Empty string, null, or undefined returns `{ blocked: false }` — never throw
- IP addresses (`192.168.1.1`) are checked against the blocklist as any other string

### Claude's Discretion
- Internal data structure choice (Set with suffix walking vs trie — research recommends Set)
- Module file organization across src/ files
- Exact set of "known special hostnames" to filter
- Whether normalization is a separate exported function or internal-only

</decisions>

<specifics>
## Specific Ideas

- User specified exact TypeScript types in initial spec: `BlockDecision`, `BlocklistSource`, `FirewallConfig`, `DomainFirewall` interface
- Precedence order is locked: allow > deny > blocklist > not-blocked
- Normalization is locked: lowercase, trim whitespace, strip trailing dot
- Label-boundary-aware suffix matching: blocking `malware.test` must NOT block `notmalware.test`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — this phase establishes the patterns

### Integration Points
- Phase 2 will wrap these pure functions with HTTP fetching and lifecycle management
- The domain index data structure must support atomic replacement (for Phase 2 refresh)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-core-logic*
*Context gathered: 2026-03-08*
