# Requirements: agent-dns-firewall

**Defined:** 2026-03-08
**Core Value:** Before your agent calls fetch(), you can ask isDomainBlocked(hostname) and drop known-bad destinations without touching the network — no infrastructure required.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Parsing

- [x] **PARSE-01**: Library can parse hosts-format blocklists (lines like `0.0.0.0 domain.com` or `127.0.0.1 domain.com`), skipping comments, blank lines, and IP-only entries
- [x] **PARSE-02**: Library can parse domain-list-format blocklists (one domain per non-blank, non-comment line)
- [ ] **PARSE-03**: Library can fetch blocklists from HTTP(S) URLs using native fetch
- [x] **PARSE-04**: All hostnames are normalized: lowercased, trimmed, trailing dot stripped

### Matching

- [x] **MATCH-01**: Exact domain match — `malware.test` in blocklist blocks `malware.test`
- [x] **MATCH-02**: Suffix/subdomain match — `malware.test` in blocklist blocks `sub.malware.test` (label-boundary aware, does NOT block `notmalware.test`)
- [x] **MATCH-03**: `isDomainBlocked(hostname)` returns a `BlockDecision` object with `blocked`, `reason`, and `listId` fields

### Overrides

- [x] **OVER-01**: Domains in the `allow` list are never blocked, regardless of blocklist or deny list
- [x] **OVER-02**: Domains in the `deny` list are always blocked (after allow check)
- [x] **OVER-03**: Precedence order is: allow > deny > blocklist > not-blocked

### Lifecycle

- [ ] **LIFE-01**: `createDomainFirewall(config)` returns a `DomainFirewall` with `start()`, `stop()`, and `isDomainBlocked()` methods
- [ ] **LIFE-02**: `start()` fetches all configured sources and populates the in-memory blocklist
- [ ] **LIFE-03**: `stop()` clears any refresh timers and cleans up resources
- [ ] **LIFE-04**: If `refreshMinutes` is set, the firewall periodically re-fetches sources using atomic swap (no vulnerability window during refresh)

### Resilience

- [ ] **RESL-01**: If a source URL fails to fetch, the library logs a warning and continues with successfully loaded sources
- [x] **RESL-02**: `isDomainBlocked()` never throws — returns `{ blocked: false }` for malformed or unexpected input

### Configuration

- [ ] **CONF-01**: `PRESET_STEVENBLACK_UNIFIED` preset provides the StevenBlack unified hosts URL pre-configured
- [ ] **CONF-02**: `PRESET_HAGEZI_LIGHT` preset provides a Hagezi light/security list URL pre-configured
- [ ] **CONF-03**: Users can combine multiple sources, custom allow/deny lists, and optional refresh interval via `FirewallConfig`

### Quality

- [ ] **QUAL-01**: Unit tests cover hosts-format and domain-list parsing (including edge cases: inline comments, mixed IPs, blank lines)
- [ ] **QUAL-02**: Unit tests cover suffix matching (exact match, subdomain match, label-boundary correctness)
- [ ] **QUAL-03**: Unit tests cover allow/deny precedence logic
- [ ] **QUAL-04**: README includes pitch, quick start example, config docs, and "what this is / isn't" section

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Parsing

- **PARSE-05**: Adblock-filter-list format parsing (extract domains from `||domain^` patterns)
- **PARSE-06**: Local file source support (`file://` paths or filesystem paths)

### Matching

- **MATCH-04**: Wildcard/glob pattern support in allow/deny lists (`*.cdn.example.com`)
- **MATCH-05**: Response caching with TTL for high-frequency callers

### Lifecycle

- **LIFE-05**: ETag/If-Modified-Since conditional refresh to avoid re-downloading unchanged lists
- **LIFE-06**: Event callback `onBlocked(hostname, decision)` for logging/alerting

## Out of Scope

| Feature | Reason |
|---------|--------|
| DNS server or DNS proxy | Different product; library is in-process only |
| HTTP proxy / MITM | Different product category entirely |
| URL-level or path-level filtering | Beyond hostname-level scope |
| Category tagging (ads vs malware vs adult) | Maintenance burden, unclear v1 value; list choice IS the category |
| Query logging / analytics dashboard | Infrastructure concern, not library feature |
| Managed DNS integration (Route 53, Cloudflare) | Different problem space |
| Per-tenant multi-tenancy | Enterprise concern; users can instantiate multiple firewalls |
| System-level DNS interception | Invasive, requires root, violates "no infrastructure" promise |
| Full adblock filter syntax | Enormous scope; domain extraction only if ever supported |
| npm publish | GitHub-only for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PARSE-01 | Phase 1 | Complete |
| PARSE-02 | Phase 1 | Complete |
| PARSE-03 | Phase 2 | Pending |
| PARSE-04 | Phase 1 | Complete |
| MATCH-01 | Phase 1 | Complete |
| MATCH-02 | Phase 1 | Complete |
| MATCH-03 | Phase 1 | Complete |
| OVER-01 | Phase 1 | Complete |
| OVER-02 | Phase 1 | Complete |
| OVER-03 | Phase 1 | Complete |
| LIFE-01 | Phase 2 | Pending |
| LIFE-02 | Phase 2 | Pending |
| LIFE-03 | Phase 2 | Pending |
| LIFE-04 | Phase 2 | Pending |
| RESL-01 | Phase 2 | Pending |
| RESL-02 | Phase 1 | Complete |
| CONF-01 | Phase 2 | Pending |
| CONF-02 | Phase 2 | Pending |
| CONF-03 | Phase 2 | Pending |
| QUAL-01 | Phase 3 | Pending |
| QUAL-02 | Phase 3 | Pending |
| QUAL-03 | Phase 3 | Pending |
| QUAL-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 after roadmap creation*
