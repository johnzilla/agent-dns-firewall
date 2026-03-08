# Architecture Patterns

**Domain:** In-process DNS blocklist / hostname egress guard
**Researched:** 2026-03-08

## How Existing Systems Are Structured

### Pi-hole (Network-Level DNS Firewall)

Pi-hole operates as a DNS sinkhole with these major components:

1. **List Manager** -- downloads and merges multiple blocklists on a schedule
2. **Parser/Normalizer** -- converts hosts-format and domains-format lists into a unified internal representation
3. **Gravity Database** -- SQLite store holding all blocked domains, allow/deny overrides, and list metadata
4. **FTL (Faster Than Light) DNS Engine** -- custom fork of dnsmasq that intercepts DNS queries, checks the gravity database, and either sinks or forwards
5. **Allow/Deny Override Layer** -- user-defined lists that take precedence over blocklists

Key architectural insight: Pi-hole separates the *list lifecycle* (fetch, parse, store, refresh) from the *query path* (lookup, decide, respond). The query path is optimized for speed; the list lifecycle tolerates latency.

### Hosts-File Tools (StevenBlack, Hagezi)

These are simpler -- they produce flat files in either:

- **Hosts format:** `0.0.0.0 malware.example.com` (one entry per line, IP + hostname)
- **Domains format:** `malware.example.com` (one domain per line)

Parsing rules: skip lines starting with `#`, ignore inline comments after `#`, normalize whitespace, lowercase the hostname, strip trailing dots.

### Browser-Based Blockers (uBlock Origin)

uBlock Origin uses a highly optimized approach:

1. **Filter Compilation** -- parses filter lists into a compact binary representation at load time
2. **Hostname Trie** -- stores blocked hostnames in a trie (prefix tree on reversed domain labels) for O(k) lookup where k = number of domain labels
3. **Hot Path Optimization** -- the lookup function is the most performance-critical code; everything else can be slower

### Common Pattern Across All Systems

Every DNS blocklist system follows the same fundamental pipeline:

```
[List Sources] --> [Fetch] --> [Parse] --> [Normalize] --> [Index] --> [Lookup]
                                                              ^
                                                    [Allow/Deny Overrides]
```

The architectural constant: **ingest is slow and infrequent; lookup is fast and frequent.** All design decisions flow from this asymmetry.

## Recommended Architecture for agent-dns-firewall

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Config Validator** | Validates and normalizes user-provided configuration | Factory (entry point) |
| **List Fetcher** | Downloads blocklist content from HTTP(S) URLs | List Parser |
| **List Parser** | Parses hosts-format and domains-format text into domain arrays | Domain Index |
| **Domain Normalizer** | Lowercases, trims, strips trailing dots, validates hostname shape | List Parser, Allow/Deny layer |
| **Domain Index** | Stores blocked domains in a fast-lookup data structure; handles suffix matching | Lookup Engine |
| **Allow/Deny Layer** | Manages user-defined override lists (allow = pass, deny = block) | Lookup Engine |
| **Lookup Engine** | Orchestrates the decision: allow list --> deny list --> domain index --> not blocked | Public API |
| **Refresh Scheduler** | Periodically triggers re-fetch of all lists | List Fetcher |
| **Factory (`createDomainFirewall`)** | Wires components together, returns public API surface | All components |

### Data Flow

```
User calls createDomainFirewall(config)
  |
  v
Config Validator -- validates sources, options, allow/deny lists
  |
  v
Factory wires up components, calls start()
  |
  v
start() triggers initial load:
  |
  +---> List Fetcher (for each source URL)
  |       |
  |       v
  |     List Parser (hosts-format or domains-format)
  |       |
  |       v
  |     Domain Normalizer (per hostname)
  |       |
  |       v
  |     Domain Index <-- accumulates all domains from all sources
  |
  +---> Allow/Deny Layer <-- built from config.allow / config.deny arrays
  |
  v
Ready. isDomainBlocked(hostname) is now callable.
```

**Query path (hot path):**

```
isDomainBlocked("sub.malware.example.com")
  |
  v
Domain Normalizer -- normalize input hostname
  |
  v
Allow List check -- if match, return { blocked: false, reason: "allow" }
  |
  v
Deny List check -- if match, return { blocked: true, reason: "deny", listId }
  |
  v
Domain Index lookup (suffix match) -- if match, return { blocked: true, reason: "blocklist", listId }
  |
  v
Return { blocked: false }
```

**Refresh path (background):**

```
Refresh Scheduler (setInterval at refreshMinutes)
  |
  v
List Fetcher --> Parser --> Normalizer --> new Domain Index
  |
  v
Atomic swap: replace old index with new index (no lock needed, single-threaded JS)
```

### Data Structure: Domain Index

**Use a `Set<string>` with suffix expansion, not a trie.** Here is why:

- Blocklists typically contain 50K-200K domains. A `Set` with suffix walking is fast enough for this scale.
- A trie adds complexity (custom data structure, serialization) with no meaningful benefit at this scale.
- V8's `Set` is backed by a hash table with O(1) average lookup. Walking up the domain hierarchy (at most 5-7 levels for any real hostname) means at most 5-7 hash lookups per query.

**Suffix matching algorithm:**

```typescript
// For hostname "a.b.malware.example.com", check:
//   "a.b.malware.example.com"  (exact)
//   "b.malware.example.com"    (parent)
//   "malware.example.com"      (parent)
//   "example.com"              (parent)
//   "com"                      (parent -- won't be in list, but cheap to check)
function isBlocked(hostname: string, blockedSet: Set<string>): boolean {
  let domain = hostname;
  while (domain) {
    if (blockedSet.has(domain)) return true;
    const dot = domain.indexOf('.');
    if (dot === -1) break;
    domain = domain.substring(dot + 1);
  }
  return false;
}
```

This is the same approach Pi-hole's FTL uses conceptually (walk up the domain tree), just with a hash set instead of a database. At 200K entries, the `Set` consumes roughly 15-30 MB of memory -- acceptable for an in-process library.

**When to reconsider:** If lists exceed 1M+ domains, a trie or compressed radix tree would save memory. That is not a v1 concern.

### Error Boundaries

Each component has a defined failure mode:

| Component | Failure Mode | Recovery |
|-----------|-------------|----------|
| List Fetcher | Network error, timeout, HTTP error | Log warning, skip source, continue with remaining sources |
| List Parser | Malformed lines | Skip individual bad lines, parse rest of file |
| Domain Normalizer | Invalid hostname chars | Skip domain, log at debug level |
| Domain Index | Empty (all sources failed) | Operate with empty set -- nothing blocked, log warning |
| Refresh Scheduler | Fetch fails on refresh | Keep old index, log warning, try again next interval |
| Lookup Engine | Any unexpected error | Catch, return `{ blocked: false }` -- never throw from hot path |

The critical invariant: **`isDomainBlocked()` never throws.** It always returns a `BlockDecision`. This is essential for agent safety -- a DNS firewall crash should not crash the agent.

## Patterns to Follow

### Pattern 1: Atomic Index Swap on Refresh

**What:** When refreshing lists, build a completely new index, then replace the old one in a single assignment.

**When:** Every refresh cycle.

**Why:** Avoids partial state. The old index serves queries until the new one is fully built. No locking needed in single-threaded Node.js.

```typescript
// Inside the firewall instance
let currentIndex: Set<string> = new Set();

async function refresh(): Promise<void> {
  const newIndex = new Set<string>();
  for (const source of sources) {
    try {
      const domains = await fetchAndParse(source);
      for (const d of domains) newIndex.add(d);
    } catch (err) {
      logger.warn(`Failed to fetch ${source.url}: ${err.message}`);
    }
  }
  currentIndex = newIndex; // atomic swap
}
```

### Pattern 2: Parse-Time Normalization

**What:** Normalize domains once during parsing, not on every lookup.

**When:** During list ingestion and during allow/deny list construction.

**Why:** Amortizes the cost. A blocklist is parsed once (or once per refresh), but queried thousands of times. Normalize the stored data, then normalize only the query input at lookup time.

### Pattern 3: Precedence Chain (Allow > Deny > Blocklist)

**What:** The lookup engine checks overrides in a fixed order: allow list first, then deny list, then blocklist.

**When:** Every `isDomainBlocked()` call.

**Why:** This matches the project spec. Allow = intentional override ("I trust this domain regardless"). Deny = intentional block ("block this even if it's not on any list"). Blocklist = community-maintained lists.

```
allow wins over deny wins over blocklist wins over default-not-blocked
```

### Pattern 4: Source Abstraction

**What:** Each blocklist source is described as a `{ url, format }` object. The fetcher and parser are format-aware but source-agnostic.

**When:** Configuration time.

**Why:** Makes it trivial to add new formats later (adblock-style, RPZ, etc.) without changing the pipeline. Presets are just pre-built source arrays.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Trie / Radix Tree for v1

**What:** Building a custom trie data structure for domain matching.

**Why bad:** Over-engineering. At 200K domains, a `Set` with suffix walking is fast enough (sub-millisecond lookups). A trie adds code complexity, debugging difficulty, and custom serialization needs. Benchmark first, optimize later.

**Instead:** Use `Set<string>` with the suffix walking algorithm. Profile under realistic load. Switch to a trie only if profiling shows the `Set` is a bottleneck (it won't be).

### Anti-Pattern 2: Synchronous Fetch on First Query

**What:** Lazily loading blocklists on the first call to `isDomainBlocked()`.

**Why bad:** Makes the first query unexpectedly slow (seconds of network I/O). Violates the principle that lookup is always fast.

**Instead:** Load lists during `start()`. The `isDomainBlocked()` function always operates on whatever index is currently loaded (even if empty during initial fetch).

### Anti-Pattern 3: Throwing from isDomainBlocked()

**What:** Letting exceptions propagate from the lookup function.

**Why bad:** This library is a safety guard for AI agents. If the guard itself crashes, the agent either halts (bad UX) or proceeds without protection (defeats the purpose).

**Instead:** Wrap the entire lookup in try/catch. On error, return `{ blocked: false }`. Log the error. The library degrades to "allow all" rather than crashing.

### Anti-Pattern 4: Shared Mutable State Between Instances

**What:** Using module-level variables for the domain index or config.

**Why bad:** Prevents multiple firewall instances with different configs. Breaks testability.

**Instead:** The factory function creates a closure. All state lives inside the closure. Each `createDomainFirewall()` call produces an independent instance.

## Scalability Considerations

| Concern | 10K domains | 200K domains | 1M+ domains |
|---------|-------------|--------------|-------------|
| Memory | ~1 MB | ~15-30 MB | ~80-150 MB (consider trie) |
| Lookup time | <0.01 ms | <0.05 ms | <0.1 ms (still fine with Set) |
| Parse time | <100 ms | ~500 ms-1 s | ~3-5 s (consider streaming parser) |
| Refresh | Negligible | ~2-5 s (network + parse) | ~10-20 s (consider incremental) |

The v1 target (StevenBlack + Hagezi) is ~150K-200K domains total. `Set<string>` handles this comfortably.

## Suggested Build Order

Based on component dependencies:

```
Phase 1: Domain Normalizer + List Parser + Domain Index
  (These are pure functions with no I/O -- easiest to build and test)

Phase 2: Lookup Engine + Allow/Deny Layer
  (Depends on Domain Index; this is the core value proposition)

Phase 3: List Fetcher + Config Validator + Factory
  (Adds I/O; connects everything; produces the public API)

Phase 4: Refresh Scheduler + Presets
  (Adds lifecycle management; presets are just config objects)
```

**Rationale:** Build from the inside out. The innermost components (normalizer, parser, index) have no dependencies and are easy to unit test. Each subsequent phase adds a layer that depends on the previous one. The factory (Phase 3) is where the public API crystallizes -- by then, all internal components exist and are tested.

## Module Structure

```
src/
  index.ts              -- public API: createDomainFirewall, presets, types
  types.ts              -- BlockDecision, FirewallConfig, Source, etc.
  factory.ts            -- createDomainFirewall implementation
  normalizer.ts         -- hostname normalization
  parser.ts             -- hosts-format and domains-format parsers
  domain-index.ts       -- Set-based domain index with suffix matching
  lookup.ts             -- precedence chain (allow > deny > blocklist)
  fetcher.ts            -- HTTP(S) list fetching with error handling
  scheduler.ts          -- refresh interval management
  presets.ts            -- PRESET_STEVENBLACK_UNIFIED, PRESET_HAGEZI_LIGHT
```

Each file is a single concern. No file depends on more than 2-3 others. The dependency graph is a clean DAG:

```
index.ts --> factory.ts --> lookup.ts --> domain-index.ts --> normalizer.ts
                        --> fetcher.ts --> parser.ts --> normalizer.ts
                        --> scheduler.ts
                        --> presets.ts
             types.ts (imported by all)
```

## Sources

- Pi-hole architecture: Based on Pi-hole FTL engine design (custom dnsmasq fork with gravity database). Well-documented in Pi-hole docs. **MEDIUM confidence** (training data, established project with stable architecture).
- Hosts file format: De facto standard from `/etc/hosts`. StevenBlack and Hagezi follow this convention. **HIGH confidence** (format is decades old and unchanged).
- uBlock Origin trie approach: Documented in uBlock Origin wiki and source code. **MEDIUM confidence** (training data, but architecture is well-known).
- Set-based suffix matching performance: Based on V8 engine characteristics and standard algorithmic analysis. **HIGH confidence** (fundamental CS + well-known V8 behavior).
- Memory estimates: Rough calculations based on V8 string internals (~50-150 bytes per Set entry including string overhead). **MEDIUM confidence** (estimates, not benchmarked for this specific use case).
