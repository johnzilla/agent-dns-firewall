# agent-dns-firewall

## What This Is

A small, framework-agnostic TypeScript library that lets agent/tool developers block outbound requests to known-bad domains using DNS blocklists, inside their process. It provides an in-process hostname-level egress guard for AI agents and automation tools running on machines without Pi-hole, pfBlockerNG, or managed DNS firewalls.

## Core Value

Before your agent calls `fetch()`, you can ask `isDomainBlocked(hostname)` and drop known-bad destinations without touching the network — no infrastructure required.

## Requirements

### Validated

- ✓ Core factory API: `createDomainFirewall(config)` returns `{ start, stop, isDomainBlocked }` — v1.0
- ✓ `isDomainBlocked(hostname)` returns a `BlockDecision` with blocked status, reason, and listId — v1.0
- ✓ Blocklist ingestion from HTTP(S) URLs in `hosts` format (StevenBlack-style) — v1.0
- ✓ Blocklist ingestion from HTTP(S) URLs in `domains` format (plain domain lists) — v1.0
- ✓ Preset: `PRESET_STEVENBLACK_UNIFIED` (StevenBlack unified hosts) — v1.0
- ✓ Preset: `PRESET_HAGEZI_LIGHT` (Hagezi light/security list) — v1.0
- ✓ Hostname normalization: lowercase, trim whitespace, strip trailing dot — v1.0
- ✓ Exact + suffix matching (`malware.test` blocks `sub.malware.test`) — v1.0
- ✓ Allow list overrides (always not blocked, checked first) — v1.0
- ✓ Deny list overrides (always blocked, checked after allow) — v1.0
- ✓ Graceful failure: failed source fetches log and continue, `isDomainBlocked` never throws — v1.0
- ✓ Optional `refreshMinutes` for periodic re-fetch — v1.0
- ✓ Unit tests for parsing, suffix matching, allow/deny precedence, error handling — v1.0
- ✓ README with pitch, quick start, config docs, and "what this is / isn't" — v1.0

### Active

(None — v1.0 shipped, next milestone TBD)

### Out of Scope

- Running as a DNS server or HTTP sidecar — library is in-process only
- Category tags (ads vs malware vs adult) — adds complexity without clear v1 value
- Integration with Route 53 / Cloudflare / managed DNS firewalls — different problem space
- Per-tenant multi-tenancy, metrics, dashboards — enterprise concerns, not v1
- npm publish — GitHub-only for now

## Context

- Shipped v1.0 with 1,308 LOC TypeScript, 111 tests passing
- Tech stack: TypeScript, Vitest, ESM-only, zero runtime dependencies
- Target runtime: Node 18+, with Deno/Bun compatibility in mind
- Blocklist sources use community-maintained lists (StevenBlack, Hagezi) in standard hosts/domains formats
- Matching uses Set-based suffix walking at label boundaries
- Allow/deny precedence: allow → deny → blocklist → not blocked

## Constraints

- **Runtime**: Node 18+ baseline, ESM module — broadest modern compatibility
- **Dependencies**: Zero runtime dependencies — keep the library tiny and auditable
- **API surface**: Single factory function + presets — minimal, stable public API

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| In-process library, not a DNS server | Simpler deployment, no port binding, works everywhere | ✓ Good |
| Suffix matching via domain hierarchy | Matches Pi-hole/hosts-file semantics users expect | ✓ Good |
| Allow takes precedence over deny | Explicit allow = intentional override, safest default | ✓ Good |
| ESM-only, no CJS build | Modern standard, avoids dual-package complexity | ✓ Good |
| Zero runtime dependencies | Keeps library tiny, auditable, no supply chain risk | ✓ Good |
| Set-based domain index with suffix walking | O(1) lookup per label, efficient for large blocklists | ✓ Good |
| Closure-based factory over class | Simpler, naturally encapsulates mutable state | ✓ Good |
| Promise.allSettled for multi-source fetch | Isolates per-source failures, no single-source failure kills startup | ✓ Good |
| Atomic swap for refresh | No vulnerability window during blocklist refresh | ✓ Good |
| Optional log callback defaulting to console | Zero deps, fully controllable, silent when desired | ✓ Good |

---
*Last updated: 2026-03-08 after v1.0 milestone*
