# Feature Landscape

**Domain:** In-process DNS blocklist/firewall library for AI agents and automation tools
**Researched:** 2026-03-08
**Confidence:** MEDIUM (based on training data knowledge of Pi-hole, AdGuard Home, uBlock Origin, hosts-file tooling; no live verification available)

## Table Stakes

Features users expect from any domain-blocking library. Missing = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Hosts-format parsing | StevenBlack unified hosts is the most widely used blocklist format. Every tool supports it. | Low | Parse `0.0.0.0 domain.com` and `127.0.0.1 domain.com` lines, skip comments/blanks |
| Plain domain-list parsing | Hagezi, oisd, and many modern lists ship as one-domain-per-line. Second most common format. | Low | Strip whitespace, skip comments (`#`), skip blank lines |
| Remote list fetching (HTTP/HTTPS) | Lists are hosted on GitHub raw URLs. Users expect to point at a URL and go. | Low | Standard `fetch()` call with error handling |
| Exact match lookup | `malware.example.com` in the list blocks `malware.example.com` | Low | Set/Map membership check |
| Suffix/subdomain matching | Pi-hole, AdGuard, and hosts-file tools all block subdomains when a parent is listed. `example.com` blocks `sub.example.com`. Users expect this. | Medium | Trie or iterative label-walk. Not complex, but needs correct implementation. |
| Allow list (whitelist) overrides | Every blocklist tool has a way to unblock false positives. Without this, the library is unusable in production -- false positives are inevitable. | Low | Check allow list before blocklist |
| Deny list (explicit block) overrides | Users need to add custom blocks beyond the community lists. Standard in Pi-hole, AdGuard, uBlock. | Low | Check deny list alongside blocklist |
| Correct precedence order | Pi-hole uses: allow > deny > blocklist. Users who know Pi-hole expect this. Surprising precedence = bug reports. | Low | Well-defined, documented order: allow > deny > blocklist > not-blocked |
| Hostname normalization | Domains come in messy: mixed case, trailing dots, whitespace. Every serious tool normalizes. | Low | `toLowerCase()`, `.trim()`, strip trailing `.` |
| Graceful failure on bad sources | A single broken URL must not crash the whole firewall. Pi-hole continues serving even when update sources fail. | Low | Try/catch per source, log warning, continue with whatever loaded |
| Structured block decision | Callers need to know *why* something was blocked (which list, which rule) for debugging and logging. Not just a boolean. | Low | Return `{ blocked, reason, source }` object |
| Programmatic start/stop lifecycle | Library must be startable and stoppable cleanly. Agents have lifecycles; dangling timers or open handles are bugs. | Low | `start()` loads lists, `stop()` clears timers |

## Differentiators

Features that set this library apart from "just use a hosts file" or "roll your own Set lookup." Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Periodic refresh with configurable interval | Blocklists update frequently (StevenBlack updates daily). Without refresh, the agent runs stale data. Pi-hole refreshes weekly by default. Most in-process "just parse a hosts file" scripts don't auto-refresh. | Medium | `setInterval` + re-fetch + atomic swap of the lookup data structure. Must handle overlapping refreshes. |
| Built-in presets for popular lists | Lowers barrier to entry massively. `PRESET_STEVENBLACK_UNIFIED` means zero config. Most npm domain-checking libs require you to find and configure URLs yourself. | Low | Just named config objects with URLs pre-filled |
| Wildcard/glob pattern support in allow/deny | Power users want `*.cdn.example.com` in their allow list. AdGuard Home supports this. Most simple libraries don't. | Medium | Pattern matching on hostname labels. Keep it simple: `*` prefix matching only, not full regex. |
| Multiple concurrent list sources | Real-world usage combines StevenBlack (ads+malware) with Hagezi (security-focused) for layered protection. Pi-hole and AdGuard both support multiple gravity lists. | Low | Array of sources, merge into single lookup structure |
| Adblock-filter-list format parsing | uBlock Origin and AdGuard use `||domain.com^` syntax. Many community lists are in this format. Supporting it opens access to a much larger list ecosystem. | Medium | Parse `||domain^` patterns only (domain-level). Ignore cosmetic filters, URL patterns, etc. Not full adblock parsing -- just domain extraction. |
| Event/callback on block decision | Agents may want to log, alert, or take action when a domain is blocked. Pi-hole has a query log; this is the in-process equivalent. | Low | Optional callback: `onBlocked(hostname, decision)` |
| Local file source support | Development/testing and air-gapped environments need to load lists from disk, not just URLs. | Low | Detect `file://` or local path, read with `fs.readFile` instead of `fetch` |
| CIDR/IP-based blocking | Some lists include IP ranges. Pi-hole handles IPs alongside domains. | High | Different data structure (prefix tree for IPs). Questionable value for an in-process hostname-level library since the caller typically has a hostname, not an IP. |
| Response caching with TTL | If `isDomainBlocked` is called in a hot loop (e.g., checking every outbound request), caching the result avoids repeated trie traversal. | Low | LRU cache with configurable TTL. Only matters at very high call volumes. |
| ETag/If-Modified-Since for list refresh | Avoid re-downloading 50MB+ lists when they haven't changed. Saves bandwidth, reduces refresh time. Pi-hole's gravity update does conditional fetching. | Medium | Store ETag/Last-Modified from response headers, send conditional request on refresh |

## Anti-Features

Features to explicitly NOT build. These are scope traps that pull the library away from its core value proposition.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| DNS server / DNS proxy | Completely different product. Pi-hole is a DNS server; this library is the opposite -- it's the thing you use when you DON'T have Pi-hole. Running a DNS server requires port binding, UDP handling, DNS protocol parsing, and system-level network config. | Stay in-process. The user calls `isDomainBlocked()` before `fetch()`. |
| HTTP proxy / MITM | Another product category entirely. Adds massive complexity (TLS interception, certificate management, proxy protocol). | Stay at hostname level. The library checks domain names, not HTTP traffic. |
| URL-level or path-level filtering | uBlock Origin does path-level filtering (`example.com/ads/*`). This requires parsing full URLs, regex matching, and maintaining complex filter rules. Way beyond scope. | Block at hostname level only. If a domain is bad, the whole domain is bad. |
| Cosmetic filtering / content filtering | uBlock does CSS injection to hide page elements. Irrelevant for an agent library -- agents don't render pages. | Not applicable to agents. Ignore entirely. |
| Category tagging (ads vs malware vs adult) | Requires maintaining a taxonomy, tagging every domain, and keeping tags in sync with upstream lists. Significant ongoing maintenance burden for unclear v1 value. | Let users choose lists by category themselves (StevenBlack for ads+malware, Hagezi for security). The list choice IS the category. |
| Query logging / analytics dashboard | Pi-hole has a web UI with charts. This is infrastructure software, not a library feature. Adds storage, rendering, and privacy concerns. | Provide the `onBlocked` callback. Let the caller decide what to log and where. |
| Managed DNS integration (Route 53, Cloudflare Gateway) | Different problem space. Cloud DNS firewalls are configured via API, not in-process. | Stay in-process. If someone has Cloudflare Gateway, they don't need this library. |
| Per-tenant / multi-tenant support | Enterprise concern. Adds configuration complexity (tenant isolation, per-tenant lists, per-tenant allow/deny). | Single-instance library. If someone needs multi-tenant, they instantiate multiple firewalls. |
| Automatic system-level DNS interception | Modifying `/etc/resolv.conf` or installing a local DNS stub is invasive and requires root. Violates the "no infrastructure" promise. | Never touch system DNS. The library is advisory: it answers "should I block this?" and the caller acts on it. |
| Full adblock filter syntax | The full adblock/uBlock filter syntax is enormous: URL patterns, regex, cosmetic rules, scriptlet injection, `$third-party` modifiers, exception rules. Supporting it all is a multi-year project. | Support domain-extraction from `\|\|domain^` syntax only. Ignore everything else. |

## Feature Dependencies

```
Hostname normalization ─────────────────────┐
                                            v
Hosts-format parsing ──────> Lookup data ──> isDomainBlocked()
Domain-list parsing ───────> structure       ^
Adblock-format parsing ────> (Set/Trie)      |
                                            |
Remote list fetching ──> List ingestion ────┘
Local file source ─────> pipeline

Allow list ──> Precedence logic ──> Block decision
Deny list ──>                       (returned by isDomainBlocked)

Periodic refresh ──> requires: Remote list fetching + start/stop lifecycle
ETag support ──────> requires: Remote list fetching + periodic refresh
Event callback ────> requires: Block decision (isDomainBlocked)
Presets ───────────> requires: Remote list fetching (just pre-configured URLs)
Wildcard patterns ─> requires: Allow/Deny lists (extends their matching)
Response caching ──> requires: isDomainBlocked (wraps it)
```

Key dependency chains:
- **Parsing before lookup:** You cannot check domains until lists are parsed and loaded
- **Normalization is foundational:** Every other feature depends on consistent hostname format
- **Lifecycle before refresh:** `start()`/`stop()` must exist before periodic refresh makes sense
- **Allow/deny before precedence:** Precedence logic is meaningless without both lists
- **Fetch before ETag:** Conditional fetching extends the basic fetch pipeline

## MVP Recommendation

Prioritize (in implementation order):

1. **Hostname normalization** -- foundational, everything depends on it
2. **Hosts-format and domain-list parsing** -- covers the two dominant list formats
3. **Remote list fetching** -- load lists from URLs (StevenBlack, Hagezi)
4. **Suffix matching via trie or label-walk** -- core blocking logic
5. **Allow and deny list overrides with correct precedence** -- unusable without allow list for false positives
6. **Structured block decision return value** -- callers need debuggability
7. **Graceful failure on bad sources** -- production readiness
8. **Built-in presets** -- zero-config experience for common lists
9. **Start/stop lifecycle** -- clean resource management
10. **Periodic refresh** -- keeps protection current without manual intervention

Defer to v2:
- **Adblock-format parsing**: Opens up more lists but not required when StevenBlack and Hagezi cover the common case
- **Wildcard patterns in allow/deny**: Power-user feature, not needed for basic usage
- **ETag/conditional refresh**: Optimization, not functionality
- **Event callbacks**: Nice-to-have, callers can implement logging around `isDomainBlocked()` themselves
- **Local file sources**: Development convenience, not blocking for v1
- **Response caching**: Only matters at very high call volumes unlikely in agent scenarios

Do not build (ever, or until explicit demand):
- DNS server, HTTP proxy, URL filtering, cosmetic filtering, category tags, dashboards, system DNS interception

## Sources

- Pi-hole documentation and feature set (training data, MEDIUM confidence)
- AdGuard Home feature comparison with Pi-hole (training data, MEDIUM confidence)
- uBlock Origin filter syntax documentation (training data, MEDIUM confidence)
- StevenBlack/hosts repository format and conventions (training data, MEDIUM confidence)
- Hagezi DNS blocklists repository (training data, MEDIUM confidence)
- General DNS blocklist ecosystem knowledge (training data, MEDIUM confidence)

**Note:** Web search and fetch tools were unavailable during this research session. All findings are based on training data knowledge of the DNS blocklist ecosystem. Confidence is MEDIUM across the board -- the domain is well-established and stable, but specific version details and recent changes could not be verified against live sources.
