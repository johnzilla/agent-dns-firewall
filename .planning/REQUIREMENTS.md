# Requirements: agent-dns-firewall

**Defined:** 2026-03-08
**Core Value:** Before your agent calls fetch(), you can ask isDomainBlocked(hostname) and drop known-bad destinations without touching the network — no infrastructure required.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Parsing

- [x] **PARSE-01**: Library can parse hosts-format blocklists (lines like `0.0.0.0 domain.com` or `127.0.0.1 domain.com`), skipping comments, blank lines, and IP-only entries
- [x] **PARSE-02**: Library can parse domain-list-format blocklists (one domain per non-blank, non-comment line)
- [x] **PARSE-03**: Library can fetch blocklists from HTTP(S) URLs using native fetch
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

- [x] **LIFE-01**: `createDomainFirewall(config)` returns a `DomainFirewall` with `start()`, `stop()`, and `isDomainBlocked()` methods
- [x] **LIFE-02**: `start()` fetches all configured sources and populates the in-memory blocklist
- [x] **LIFE-03**: `stop()` clears any refresh timers and cleans up resources
- [x] **LIFE-04**: If `refreshMinutes` is set, the firewall periodically re-fetches sources using atomic swap (no vulnerability window during refresh)

### Resilience

- [x] **RESL-01**: If a source URL fails to fetch, the library logs a warning and continues with successfully loaded sources
- [x] **RESL-02**: `isDomainBlocked()` never throws — returns `{ blocked: false }` for malformed or unexpected input

### Configuration

- [x] **CONF-01**: `PRESET_STEVENBLACK_UNIFIED` preset provides the StevenBlack unified hosts URL pre-configured
- [x] **CONF-02**: `PRESET_HAGEZI_LIGHT` preset provides a Hagezi light/security list URL pre-configured
- [x] **CONF-03**: Users can combine multiple sources, custom allow/deny lists, and optional refresh interval via `FirewallConfig`

### Quality

- [x] **QUAL-01**: Unit tests cover hosts-format and domain-list parsing (including edge cases: inline comments, mixed IPs, blank lines)
- [x] **QUAL-02**: Unit tests cover suffix matching (exact match, subdomain match, label-boundary correctness)
- [x] **QUAL-03**: Unit tests cover allow/deny precedence logic
- [x] **QUAL-04**: README includes pitch, quick start example, config docs, and "what this is / isn't" section

## v1.1 Requirements

Requirements for npm publish milestone. Each maps to roadmap phases.

### Package Metadata

- [ ] **PKG-01**: package.json `exports` field uses conditional exports with `types` condition first
- [ ] **PKG-02**: package.json has `types`, `files`, `engines`, `keywords`, `repository`, `homepage`, `bugs`, `author` fields
- [ ] **PKG-03**: package.json version set to `1.0.0` for first npm publish
- [ ] **PKG-04**: package.json has `sideEffects: false` for tree-shaking
- [ ] **PKG-05**: LICENSE file exists in project root

### Build

- [ ] **BUILD-01**: tsconfig `moduleResolution` switched from `bundler` to `nodenext` (and `module` to `nodenext`)
- [ ] **BUILD-02**: `prepublishOnly` script runs build + validation before publish

### Validation

- [ ] **VAL-01**: publint installed as dev dependency and validates package structure
- [ ] **VAL-02**: @arethetypeswrong/cli installed as dev dependency and validates type resolution

### CI/CD

- [ ] **CI-01**: GitHub Actions CI workflow runs tests on push and PR
- [ ] **CI-02**: CI tests across Node 18, 20, and 22
- [ ] **CI-03**: CI runs build and validation (publint + attw) after tests

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Parsing

- **PARSE-05**: Adblock-filter-list format parsing (extract domains from `||domain^` patterns)
- **PARSE-06**: Local file source support (`file://` paths or filesystem paths)

### Matching

- **MATCH-04**: Wildcard/glob pattern support in allow/deny lists (`*.cdn.example.com`)
- **MATCH-05**: Response caching with TTL for high-frequency callers

### Lifecycle

- **LIFE-06**: Event callback `onBlocked(hostname, decision)` for logging/alerting

### Publishing

- **PUB-01**: Automated publish on git tag via OIDC trusted publishing with provenance badge

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
| CJS build | ESM-only; Node 18+ has full ESM support |
| semantic-release / changesets | Overkill for single-maintainer library at this scale |
| .npmignore | files whitelist is safer than denylist approach |
| Bundling into single file | Library is small; individual modules allow tree-shaking |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PARSE-01 | Phase 1 | Complete |
| PARSE-02 | Phase 1 | Complete |
| PARSE-03 | Phase 2 | Complete |
| PARSE-04 | Phase 1 | Complete |
| MATCH-01 | Phase 1 | Complete |
| MATCH-02 | Phase 1 | Complete |
| MATCH-03 | Phase 1 | Complete |
| OVER-01 | Phase 1 | Complete |
| OVER-02 | Phase 1 | Complete |
| OVER-03 | Phase 1 | Complete |
| LIFE-01 | Phase 2 | Complete |
| LIFE-02 | Phase 2 | Complete |
| LIFE-03 | Phase 2 | Complete |
| LIFE-04 | Phase 2 | Complete |
| RESL-01 | Phase 2 | Complete |
| RESL-02 | Phase 1 | Complete |
| CONF-01 | Phase 2 | Complete |
| CONF-02 | Phase 2 | Complete |
| CONF-03 | Phase 2 | Complete |
| QUAL-01 | Phase 3 | Complete |
| QUAL-02 | Phase 3 | Complete |
| QUAL-03 | Phase 3 | Complete |
| QUAL-04 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-09 after v1.1 milestone requirements*
