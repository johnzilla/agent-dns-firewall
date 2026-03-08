# agent-dns-firewall

## What This Is

A small, framework-agnostic TypeScript library that lets agent/tool developers block outbound requests to known-bad domains using DNS blocklists, inside their process. It provides an in-process hostname-level egress guard for AI agents and automation tools running on machines without Pi-hole, pfBlockerNG, or managed DNS firewalls.

## Core Value

Before your agent calls `fetch()`, you can ask `isDomainBlocked(hostname)` and drop known-bad destinations without touching the network — no infrastructure required.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Core factory API: `createDomainFirewall(config)` returns `{ start, stop, isDomainBlocked }`
- [ ] `isDomainBlocked(hostname)` returns a `BlockDecision` with blocked status, reason, and listId
- [ ] Blocklist ingestion from HTTP(S) URLs in `hosts` format (StevenBlack-style)
- [ ] Blocklist ingestion from HTTP(S) URLs in `domains` format (plain domain lists)
- [ ] Preset: `PRESET_STEVENBLACK_UNIFIED` (StevenBlack unified hosts)
- [ ] Preset: `PRESET_HAGEZI_LIGHT` (Hagezi light/security list)
- [ ] Hostname normalization: lowercase, trim whitespace, strip trailing dot
- [ ] Exact + suffix matching (`malware.test` blocks `sub.malware.test`)
- [ ] Allow list overrides (always not blocked, checked first)
- [ ] Deny list overrides (always blocked, checked after allow)
- [ ] Graceful failure: failed source fetches log and continue, `isDomainBlocked` never throws
- [ ] Optional `refreshMinutes` for periodic re-fetch
- [ ] Unit tests for parsing, suffix matching, allow/deny precedence, error handling
- [ ] README with pitch, quick start, config docs, and "what this is / isn't"

### Out of Scope

- Running as a DNS server or HTTP sidecar — library is in-process only
- Category tags (ads vs malware vs adult) — adds complexity without clear v1 value
- Integration with Route 53 / Cloudflare / managed DNS firewalls — different problem space
- Per-tenant multi-tenancy, metrics, dashboards — enterprise concerns, not v1
- npm publish — GitHub-only for now

## Context

- Target runtime: Node 18+, with Deno/Bun compatibility in mind
- ESM-first (`"type": "module"`)
- Blocklist sources use community-maintained lists (StevenBlack, Hagezi) in standard hosts/domains formats
- Matching uses suffix-based approach: blocking `example.com` also blocks `sub.example.com`
- Allow/deny precedence: allow → deny → blocklist → not blocked

## Constraints

- **Runtime**: Node 18+ baseline, ESM module — broadest modern compatibility
- **Dependencies**: Zero runtime dependencies — keep the library tiny and auditable
- **API surface**: Single factory function + presets — minimal, stable public API

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| In-process library, not a DNS server | Simpler deployment, no port binding, works everywhere | — Pending |
| Suffix matching via domain hierarchy | Matches Pi-hole/hosts-file semantics users expect | — Pending |
| Allow takes precedence over deny | Explicit allow = intentional override, safest default | — Pending |
| ESM-only, no CJS build | Modern standard, avoids dual-package complexity | — Pending |
| Zero runtime dependencies | Keeps library tiny, auditable, no supply chain risk | — Pending |

---
*Last updated: 2026-03-08 after initialization*
