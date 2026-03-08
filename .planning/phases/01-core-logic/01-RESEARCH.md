# Phase 1: Core Logic - Research

**Researched:** 2026-03-08
**Domain:** TypeScript pure-function domain parsing, matching, and override logic
**Confidence:** HIGH

## Summary

Phase 1 implements the core engine of agent-dns-firewall as pure functions with zero I/O. The domain is well-understood: parsing two standard blocklist formats (hosts-format and domain-list-format), building an in-memory domain index using a `Set<string>` with suffix walking, and applying allow/deny/blocklist precedence logic. All of this is greenfield TypeScript targeting Node 18+ with ESM modules and zero runtime dependencies.

The technical risk is low. The formats are simple line-based text. The suffix matching algorithm is straightforward when using label-boundary-aware dot-prefixed lookups (checking `.malware.test` in the Set, not substring matching). The override precedence is a simple ordered check. The main quality concern is edge-case coverage: inline comments, multi-token hosts lines, URL/port stripping in input sanitization, and ensuring `isDomainBlocked` never throws.

**Primary recommendation:** Implement as 3-4 focused modules (normalize, parse, match/index, decide) exporting pure functions. Use `Set<string>` for the domain index with dot-prefixed suffix walking. Test with Vitest.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Allow and deny lists use **exact match only** -- no suffix matching
- If `google.com` is in the allow list, `ads.google.com` is NOT allowed (must be explicitly listed)
- Same for deny: `evil.com` in deny does not block `sub.evil.com`
- This is intentionally different from blocklist matching (which uses suffix matching)
- When blocked by deny list: `reason = "custom-deny"`, `listId = undefined`
- When blocked by blocklist: `reason = "blocklist"`, `listId = source.id` (e.g., "stevenblack-unified")
- When not blocked: `blocked = false`, no reason or listId needed
- Hosts format parsing: take all non-IP tokens from each line, strip inline comments, filter known special hostnames, handle `\n` and `\r\n`
- Input sanitization: extract hostname from URLs, strip ports, empty/null/undefined returns `{ blocked: false }`, IPs checked as normal strings
- Precedence order: allow > deny > blocklist > not-blocked
- Normalization: lowercase, trim whitespace, strip trailing dot
- Label-boundary-aware suffix matching: blocking `malware.test` must NOT block `notmalware.test`
- Exact TypeScript types specified: `BlockDecision`, `BlocklistSource`, `FirewallConfig`, `DomainFirewall` interface

### Claude's Discretion
- Internal data structure choice (Set with suffix walking vs trie -- research recommends Set)
- Module file organization across src/ files
- Exact set of "known special hostnames" to filter
- Whether normalization is a separate exported function or internal-only

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PARSE-01 | Parse hosts-format blocklists (lines like `0.0.0.0 domain.com`), skipping comments, blank lines, IP-only entries | Hosts format parsing section, StevenBlack format analysis |
| PARSE-02 | Parse domain-list-format blocklists (one domain per non-blank, non-comment line) | Simpler variant of PARSE-01, same normalization pipeline |
| PARSE-04 | All hostnames normalized: lowercased, trimmed, trailing dot stripped | Normalization function pattern |
| MATCH-01 | Exact domain match -- `malware.test` in blocklist blocks `malware.test` | Set.has() direct lookup |
| MATCH-02 | Suffix/subdomain match -- label-boundary aware, does NOT block `notmalware.test` | Dot-prefixed suffix walking algorithm |
| MATCH-03 | `isDomainBlocked(hostname)` returns `BlockDecision` with `blocked`, `reason`, `listId` | BlockDecision type definition, decision logic |
| OVER-01 | Domains in allow list are never blocked | Exact-match Set lookup, checked first |
| OVER-02 | Domains in deny list are always blocked (after allow check) | Exact-match Set lookup, checked second |
| OVER-03 | Precedence order: allow > deny > blocklist > not-blocked | Decision function ordering |
| RESL-02 | `isDomainBlocked()` never throws -- returns `{ blocked: false }` for malformed input | try/catch wrapper, input sanitization |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7+ | Type safety, ESM compilation | Current stable, good ESM support |
| Node.js | 18+ | Runtime target | LTS baseline per project constraint |

### Supporting (Dev Dependencies Only)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 3.x | Unit testing | All test files -- native ESM + TS, zero config |
| @vitest/coverage-v8 | 3.x | Code coverage | Coverage reporting during test runs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Node.js built-in test runner | Node test runner works but lacks the ergonomics (watch mode, coverage integration, describe/it API). Vitest is the standard for ESM TS projects |
| Set + suffix walking | Trie data structure | Trie is faster for huge datasets (100k+ domains) but Set is simpler, fast enough for blocklists up to ~100k domains, and easier to debug. StevenBlack unified is ~76k domains -- well within Set performance |

**Installation:**
```bash
npm init -y
npm install -D typescript vitest @vitest/coverage-v8
```

**Runtime dependencies: NONE** (project constraint: zero runtime deps)

## Architecture Patterns

### Recommended Project Structure
```
src/
  types.ts          # BlockDecision, BlocklistSource, FirewallConfig, DomainFirewall types
  normalize.ts      # Domain normalization (lowercase, trim, strip trailing dot)
  parse.ts          # parseHostsFormat(), parseDomainList() -- string -> string[]
  match.ts          # DomainIndex class or functions: build index, check domain
  decide.ts         # isDomainBlocked() -- orchestrates allow/deny/blocklist precedence
  index.ts          # Public API re-exports
```

### Pattern 1: Domain Normalization
**What:** Single pure function that canonicalizes any domain input
**When to use:** Before inserting into index, before querying index, before checking allow/deny lists

```typescript
export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');  // strip trailing dot
}
```

### Pattern 2: Hosts Format Parsing
**What:** Parse a multi-line string in hosts format into a clean domain array
**When to use:** Processing StevenBlack-style blocklists

```typescript
const IP_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$|^[0:]+[01]?$/;
const SPECIAL_HOSTS = new Set([
  'localhost', 'localhost.localdomain', 'local',
  'broadcasthost', 'ip6-localhost', 'ip6-loopback',
  'ip6-localnet', 'ip6-mcastprefix', 'ip6-allnodes',
  'ip6-allrouters', 'ip6-allhosts',
]);

export function parseHostsFormat(content: string): string[] {
  const domains: string[] = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const stripped = line.split('#')[0].trim();  // remove inline comments
    if (!stripped) continue;
    const tokens = stripped.split(/\s+/);
    for (const token of tokens) {
      if (IP_PATTERN.test(token)) continue;      // skip IP addresses
      const normalized = normalizeDomain(token);
      if (normalized && !SPECIAL_HOSTS.has(normalized)) {
        domains.push(normalized);
      }
    }
  }
  return domains;
}
```

### Pattern 3: Label-Boundary-Aware Suffix Matching (Set + Suffix Walking)
**What:** Check if a domain or any of its parent domains appear in the blocklist
**When to use:** The core matching algorithm for blocklist lookups

```typescript
// Building the index -- just a Set of normalized domains
export function buildDomainIndex(domains: string[]): Set<string> {
  return new Set(domains);
}

// Querying -- walk up the domain hierarchy
export function isDomainInIndex(domain: string, index: Set<string>): boolean {
  // Exact match first
  if (index.has(domain)) return true;

  // Suffix walk: check parent domains at label boundaries
  let pos = domain.indexOf('.');
  while (pos !== -1) {
    const parent = domain.slice(pos + 1);
    if (index.has(parent)) return true;
    pos = domain.indexOf('.', pos + 1);
  }
  return false;
}
```

**Why this is correct:** By walking at `.` boundaries only, `notmalware.test` checks: `notmalware.test` (no match), then `test` (no match). It never checks `malware.test` because that is not a parent domain -- it would require a substring match which we deliberately avoid.

### Pattern 4: Input Sanitization
**What:** Extract a clean hostname from potentially messy input (URLs, ports, null)
**When to use:** Entry point of `isDomainBlocked()`

```typescript
export function sanitizeInput(input: unknown): string | null {
  if (input == null || typeof input !== 'string') return null;
  let hostname = input.trim();
  if (!hostname) return null;

  // Extract hostname from URL
  try {
    if (hostname.includes('://')) {
      hostname = new URL(hostname).hostname;
    }
  } catch {
    // Not a valid URL, treat as hostname
  }

  // Strip port
  const bracketEnd = hostname.lastIndexOf(']'); // IPv6 bracket
  const colonPos = hostname.lastIndexOf(':');
  if (colonPos > bracketEnd) {
    hostname = hostname.slice(0, colonPos);
  }

  return normalizeDomain(hostname) || null;
}
```

### Pattern 5: Decision Function with Precedence
**What:** Orchestrate the full allow > deny > blocklist > not-blocked chain
**When to use:** The public `isDomainBlocked()` implementation

```typescript
export interface BlockDecision {
  blocked: boolean;
  reason?: 'custom-deny' | 'blocklist';
  listId?: string;
}

// allowSet and denySet use EXACT match only (per user decision)
// blocklistIndex uses suffix matching
export function decide(
  domain: string,
  allowSet: Set<string>,
  denySet: Set<string>,
  blocklistEntries: Array<{ index: Set<string>; sourceId: string }>,
): BlockDecision {
  // 1. Allow check (exact match only)
  if (allowSet.has(domain)) {
    return { blocked: false };
  }

  // 2. Deny check (exact match only)
  if (denySet.has(domain)) {
    return { blocked: true, reason: 'custom-deny' };
  }

  // 3. Blocklist check (suffix matching)
  for (const entry of blocklistEntries) {
    if (isDomainInIndex(domain, entry.index)) {
      return { blocked: true, reason: 'blocklist', listId: entry.sourceId };
    }
  }

  // 4. Not blocked
  return { blocked: false };
}
```

### Anti-Patterns to Avoid
- **Substring matching for domains:** Never use `domain.includes(blocked)` or `domain.endsWith(blocked)` -- this causes `notmalware.test` to match `malware.test`. Always split at label boundaries (dots).
- **Throwing from isDomainBlocked:** The function must NEVER throw. Wrap the entire body in try/catch returning `{ blocked: false }`.
- **Mutating the index during queries:** The domain index must be treated as immutable once built. Phase 2 will swap entire indexes atomically.
- **Regex for domain matching:** Regex is slower and harder to maintain than Set-based lookup for this use case. Avoid it for the matching path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL parsing | Custom regex URL parser | `new URL()` built-in | Handles edge cases (auth, IPv6, encoded chars) correctly |
| Line splitting | Custom character-by-character scanner | `content.split(/\r?\n/)` | Handles both line ending styles, well-tested |
| Domain normalization | Multiple ad-hoc `.toLowerCase()` calls | Single `normalizeDomain()` function | Centralizes logic, ensures consistency |

**Key insight:** The domain here is simple enough that "don't hand-roll" mostly means "don't over-engineer." A Set and string splitting is the right level of abstraction. A trie or radix tree would be premature optimization.

## Common Pitfalls

### Pitfall 1: Substring vs. Label-Boundary Matching
**What goes wrong:** `notmalware.test` gets blocked when `malware.test` is in the blocklist
**Why it happens:** Using `endsWith('malware.test')` instead of walking dot-delimited labels
**How to avoid:** Only check at `.` boundaries -- walk parent domains by finding each `.` position
**Warning signs:** Tests that only check exact matches pass, but substring false-positive tests fail

### Pitfall 2: Forgetting to Normalize Before Lookup
**What goes wrong:** `Malware.Test` doesn't match `malware.test` in the Set
**Why it happens:** Normalizing at parse time but not at query time (or vice versa)
**How to avoid:** Normalize in both paths -- when building the index AND when querying it
**Warning signs:** Case-sensitive test inputs fail

### Pitfall 3: Inline Comments in Hosts Files
**What goes wrong:** `"0.0.0.0 ad.com # tracking"` parses `#` or `tracking` as domains
**Why it happens:** Splitting on whitespace without first stripping comments
**How to avoid:** Always `line.split('#')[0]` BEFORE splitting on whitespace
**Warning signs:** Weird entries in parsed domain lists containing `#` characters

### Pitfall 4: IP Address Leaking into Domain List
**What goes wrong:** `0.0.0.0` or `127.0.0.1` appears in the domain Set
**Why it happens:** Not filtering IP tokens from hosts-format lines
**How to avoid:** Check each token against IP pattern before adding
**Warning signs:** IP addresses showing up in domain counts

### Pitfall 5: isDomainBlocked Throwing on Bad Input
**What goes wrong:** Caller passes `null`, `undefined`, `""`, or an object -- function throws TypeError
**Why it happens:** No input validation/sanitization at the entry point
**How to avoid:** Guard clause at top of function, wrap body in try/catch
**Warning signs:** Any unhandled exception from isDomainBlocked in tests

### Pitfall 6: Allow/Deny Using Suffix Match by Mistake
**What goes wrong:** Allowing `google.com` accidentally allows `ads.google.com`
**Why it happens:** Reusing the blocklist suffix-matching logic for allow/deny
**How to avoid:** Allow and deny use `Set.has()` (exact match) only -- this is a locked decision
**Warning signs:** Allow/deny tests with subdomains behaving differently than expected

## Code Examples

### TypeScript Project Configuration

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": false,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

**package.json (relevant fields):**
```json
{
  "name": "agent-dns-firewall",
  "type": "module",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
```

### Complete Type Definitions
```typescript
// src/types.ts
export interface BlockDecision {
  blocked: boolean;
  reason?: 'custom-deny' | 'blocklist';
  listId?: string;
}

export interface BlocklistSource {
  id: string;
  url: string;
  format: 'hosts' | 'domains';
}

export interface FirewallConfig {
  sources: BlocklistSource[];
  allow?: string[];
  deny?: string[];
  refreshMinutes?: number;
}

export interface DomainFirewall {
  start(): Promise<void>;
  stop(): void;
  isDomainBlocked(domain: string): BlockDecision;
}
```

### Test Pattern Example
```typescript
// tests/match.test.ts
import { describe, it, expect } from 'vitest';
import { buildDomainIndex, isDomainInIndex } from '../src/match.js';

describe('suffix matching', () => {
  const index = buildDomainIndex(['malware.test', 'ads.example.com']);

  it('blocks exact match', () => {
    expect(isDomainInIndex('malware.test', index)).toBe(true);
  });

  it('blocks subdomain', () => {
    expect(isDomainInIndex('sub.malware.test', index)).toBe(true);
  });

  it('does NOT block partial label match', () => {
    expect(isDomainInIndex('notmalware.test', index)).toBe(false);
  });

  it('does NOT block unrelated domain', () => {
    expect(isDomainInIndex('safe.test', index)).toBe(false);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `module: "commonjs"` | `module: "ES2022"` + `"type": "module"` | Node 18+ era | ESM is the default for new packages |
| Jest for testing | Vitest | 2023+ | Native ESM support, faster, less config |
| `moduleResolution: "node"` | `moduleResolution: "bundler"` or `"nodenext"` | TS 5.0+ | Better ESM module resolution |

**Deprecated/outdated:**
- `ts-node` for running TypeScript: Use `vitest` directly for tests (it handles TS natively via esbuild)
- `"esModuleInterop": true`: Not needed for ESM-only projects; `verbatimModuleSyntax` is the modern equivalent

## Open Questions

1. **Module file granularity**
   - What we know: 4-5 modules is right (types, normalize, parse, match, decide)
   - What's unclear: Whether `match.ts` and `decide.ts` should be merged into one file
   - Recommendation: Keep separate -- `match.ts` handles index operations, `decide.ts` handles precedence logic. Cleaner for testing

2. **Blocklist source tracking in the index**
   - What we know: `BlockDecision` needs `listId` when blocked by a blocklist
   - What's unclear: Whether to store one index per source or a single merged index with source tracking
   - Recommendation: One index per source (array of `{ index: Set<string>, sourceId: string }`) -- simpler, supports Phase 2 atomic refresh per-source, and avoids needing a `Map<string, string>` for domain-to-source tracking

3. **Exact set of special hostnames to filter**
   - What we know: localhost, broadcasthost, local, ip6-localhost, ip6-loopback are confirmed
   - What's unclear: Full list varies by OS and blocklist source
   - Recommendation: Use the set from the code example above (covers Linux + macOS standard entries). Can be extended later without breaking changes

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `vitest.config.ts` (Wave 0 -- needs creation) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARSE-01 | Hosts-format parsing (comments, blanks, IPs, multi-token) | unit | `npx vitest run tests/parse.test.ts -t "hosts"` | No -- Wave 0 |
| PARSE-02 | Domain-list-format parsing | unit | `npx vitest run tests/parse.test.ts -t "domain-list"` | No -- Wave 0 |
| PARSE-04 | Normalization (lowercase, trim, trailing dot) | unit | `npx vitest run tests/normalize.test.ts` | No -- Wave 0 |
| MATCH-01 | Exact domain match | unit | `npx vitest run tests/match.test.ts -t "exact"` | No -- Wave 0 |
| MATCH-02 | Suffix match with label-boundary correctness | unit | `npx vitest run tests/match.test.ts -t "suffix"` | No -- Wave 0 |
| MATCH-03 | isDomainBlocked returns BlockDecision shape | unit | `npx vitest run tests/decide.test.ts -t "BlockDecision"` | No -- Wave 0 |
| OVER-01 | Allow list prevents blocking | unit | `npx vitest run tests/decide.test.ts -t "allow"` | No -- Wave 0 |
| OVER-02 | Deny list forces blocking | unit | `npx vitest run tests/decide.test.ts -t "deny"` | No -- Wave 0 |
| OVER-03 | Precedence: allow > deny > blocklist | unit | `npx vitest run tests/decide.test.ts -t "precedence"` | No -- Wave 0 |
| RESL-02 | isDomainBlocked never throws on bad input | unit | `npx vitest run tests/decide.test.ts -t "resilience"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `package.json` -- project initialization with `"type": "module"`
- [ ] `tsconfig.json` -- TypeScript ESM configuration
- [ ] `vitest.config.ts` -- Vitest configuration
- [ ] `tests/parse.test.ts` -- parsing test file
- [ ] `tests/normalize.test.ts` -- normalization test file
- [ ] `tests/match.test.ts` -- matching/index test file
- [ ] `tests/decide.test.ts` -- decision/precedence test file
- [ ] Dev dependencies: `typescript`, `vitest`, `@vitest/coverage-v8`

## Sources

### Primary (HIGH confidence)
- [2ality ESM TypeScript packages tutorial](https://2ality.com/2025/02/typescript-esm-packages.html) -- tsconfig.json and package.json exports configuration
- [StevenBlack/hosts raw file](https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts) -- real-world hosts format analysis (~76k domains, `0.0.0.0` prefix, inline comments)
- [Vitest official docs](https://vitest.dev/config/) -- configuration and API reference
- [TypeScript TSConfig reference](https://www.typescriptlang.org/tsconfig/) -- compiler options

### Secondary (MEDIUM confidence)
- [DEV Community: Modern Node.js + TypeScript Setup 2025](https://dev.to/woovi/a-modern-nodejs-typescript-setup-for-2025-nlk) -- project structure patterns
- [TheLinuxCode: TypeScript Project Setup 2026](https://thelinuxcode.com/set-up-a-typescript-project-in-2026-node-tsconfig-and-a-clean-build-pipeline/) -- current best practices

### Tertiary (LOW confidence)
- None -- all findings verified against primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- TypeScript + Vitest is well-established, zero-dep constraint simplifies choices
- Architecture: HIGH -- Set-based suffix walking is a proven pattern for DNS blocklist matching, well within performance bounds for ~100k domain lists
- Pitfalls: HIGH -- Label-boundary matching is the most critical correctness concern and is well-understood
- Code patterns: HIGH -- All patterns are straightforward pure-function TypeScript with no external dependencies

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable domain, 30-day validity)
