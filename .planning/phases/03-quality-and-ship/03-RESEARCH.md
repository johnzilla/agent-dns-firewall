# Phase 3: Quality and Ship - Research

**Researched:** 2026-03-08
**Domain:** Unit testing (Vitest), README documentation, edge case coverage
**Confidence:** HIGH

## Summary

Phase 3 is about hardening existing tests and writing the README. The codebase already has 100 passing tests across 7 test files covering all modules (normalize, parse, match, decide, fetch, presets, firewall). The test infrastructure is mature: Vitest 4.0.18, working config, mocking patterns established. The primary work is a gap analysis against the QUAL requirements to identify missing edge cases, plus writing a comprehensive README from scratch (currently just a title).

The existing test suite already covers most of QUAL-01, QUAL-02, and QUAL-03 scenarios. The gaps are narrow: a few specific edge cases called out in the requirements (e.g., mixed IPs in hosts lines, multi-domain lines in domain-list format -- which should be rejected) and some boundary conditions worth adding for completeness. QUAL-04 (README) is entirely unstarted.

**Primary recommendation:** Audit existing tests against each QUAL requirement bullet point, add only the missing edge cases, then write the README following the structure specified in QUAL-04.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QUAL-01 | Unit tests cover hosts-format and domain-list parsing (including edge cases: inline comments, mixed IPs, blank lines) | Existing `parse.test.ts` covers most cases. Gaps identified below in Test Gap Analysis. |
| QUAL-02 | Unit tests cover suffix matching (exact match, subdomain match, label-boundary correctness) | Existing `match.test.ts` covers all required scenarios. Minor additions possible. |
| QUAL-03 | Unit tests cover allow/deny precedence logic | Existing `decide.test.ts` has dedicated precedence section covering all combinations. Gaps identified below. |
| QUAL-04 | README includes pitch, quick start example, config docs, and "what this is / isn't" section | README is empty (just a title). Needs full creation. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.0.18 | Test runner and assertion library | Already installed and configured in project |
| @vitest/coverage-v8 | ^4.0.18 | Code coverage via V8 | Already installed; useful for verifying test completeness |

### Supporting
No additional libraries needed. All tooling is already in place.

## Architecture Patterns

### Existing Test Structure
```
tests/
  normalize.test.ts   # 6 tests  - normalizeDomain edge cases
  parse.test.ts       # 18 tests - hosts-format and domain-list parsing
  match.test.ts       # 12 tests - buildDomainIndex and isDomainInIndex
  decide.test.ts      # 33 tests - sanitizeInput, isDomainBlocked, precedence
  fetch.test.ts       # 8 tests  - fetchSource, fetchAllSources
  presets.test.ts     # 10 tests - preset constants and config types
  firewall.test.ts    # 13 tests - integration: factory, start/stop, refresh
```

### Test Organization Pattern (already established)
Tests use `describe` blocks grouped by feature/requirement. Requirement IDs are referenced in describe names (e.g., `'BlockDecision shape (MATCH-03)'`, `'Allow override (OVER-01)'`). New tests should follow this pattern.

### README Structure Pattern
For a small focused library like this, the README should follow:
```
# agent-dns-firewall

[One-line pitch]

## What This Is / What This Isn't

[Scope clarification table or bullets]

## Quick Start

[npm install + minimal working example]

## Configuration Reference

[FirewallConfig fields, BlocklistSource, presets]

## API Reference

[createDomainFirewall, isDomainBlocked, BlockDecision]

## License
```

## Test Gap Analysis

### QUAL-01: Parsing Edge Cases

**Already covered in `parse.test.ts`:**
- Standard `0.0.0.0` and `127.0.0.1` prefixes
- Comment lines (`# comment`)
- Inline comments (`domain # tracking`)
- Blank lines
- Multi-domain hosts lines (`0.0.0.0 ad1.com ad2.com`)
- IP-only lines
- Special hostnames (localhost etc.)
- Case normalization
- `\r\n` line endings
- IPv6 `::1` prefix

**Gaps to add:**
- Hosts line with mixed IP formats (e.g., `127.0.0.1` with IPv6 domains, or less common IPs like `0.0.0.0` followed by many domains)
- Tabs as whitespace separators (`0.0.0.0\tad.com`)
- Lines with only whitespace (spaces/tabs, no domain)
- Domain-list: line that looks like a hosts line but is in domain-list format (should parse the entire line as-is or handle gracefully)
- Very long lines / unusual characters
- Trailing whitespace after domain

**Verdict:** Most QUAL-01 requirements are already met. Add 3-5 targeted edge case tests.

### QUAL-02: Suffix Matching

**Already covered in `match.test.ts`:**
- Exact match (`malware.test`)
- Subdomain match (`sub.malware.test`)
- Deep subdomain match (`deep.sub.malware.test`)
- Label-boundary: `notmalware.test` does NOT match `malware.test` (the critical false-positive test)
- Unrelated domain returns false
- TLD not in index returns false
- Empty index returns false
- Multi-level domain exact match
- Multi-level subdomain match
- Parent of multi-level entry does NOT match

**Gaps to add:**
- Single-label domain in index (e.g., `com` -- should match `anything.com`)
- Domain that is a suffix of another but at wrong label boundary (e.g., `ware.test` in index, checking `malware.test` -- should NOT match)

**Verdict:** QUAL-02 is essentially complete. Add 1-2 edge cases for thoroughness.

### QUAL-03: Allow/Deny Precedence

**Already covered in `decide.test.ts`:**
- Allow overrides blocklist
- Allow overrides deny
- Allow uses exact match only (subdomain NOT allowed)
- Deny blocks when not in allow
- Deny uses exact match only (subdomain NOT denied)
- All three combined: allow > deny > blocklist (domain in all three = not blocked)
- Deny > blocklist (domain in both = custom-deny reason)
- Blocklist only
- Domain in nothing = not blocked

**Gaps to add:**
- Allow + blocklist (no deny): domain allowed, subdomain blocked
- Deny + blocklist: domain denied with deny reason (not blocklist reason)
- Multiple blocklists: domain in second list gets second list's ID
- Domain in deny only (no blocklist) -- already covered but worth explicit naming

**Verdict:** QUAL-03 is substantially complete. Add 2-3 combination tests for completeness.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test runner | Custom test harness | Vitest (already configured) | Already working with 100 tests |
| Coverage reporting | Manual test audit | `vitest run --coverage` | V8 coverage already installed |
| README formatting | Custom doc generator | Hand-written Markdown | Small library, single file is sufficient |

## Common Pitfalls

### Pitfall 1: Over-testing implementation details
**What goes wrong:** Tests that check internal data structures rather than behavior break on refactors.
**How to avoid:** Test through public API (`parseHostsFormat`, `isDomainBlocked`, etc.), not internal state. The existing tests already follow this pattern well.

### Pitfall 2: README code examples that don't compile
**What goes wrong:** Quick-start examples use wrong import paths, missing types, or outdated API.
**How to avoid:** Write the example code so it matches the actual exported API from `src/index.ts`. Verify imports match the `exports` field in `package.json` (`./dist/index.js`).

### Pitfall 3: Missing the "what this isn't" section
**What goes wrong:** Users try to use the library as a DNS server, proxy, or system-level blocker.
**How to avoid:** Explicitly state scope boundaries. The `Out of Scope` section in REQUIREMENTS.md provides the exact list to reference.

### Pitfall 4: README shows `require()` syntax for ESM-only package
**What goes wrong:** Package is `"type": "module"` with no CJS build. CommonJS examples will fail.
**How to avoid:** All examples must use `import` syntax. Note Node 18+ requirement.

## Code Examples

### Quick Start Example (for README)
```typescript
import {
  createDomainFirewall,
  PRESET_STEVENBLACK_UNIFIED,
} from 'agent-dns-firewall';

const firewall = createDomainFirewall({
  sources: [PRESET_STEVENBLACK_UNIFIED],
});

await firewall.start();

const decision = firewall.isDomainBlocked('suspicious-domain.example');
if (decision.blocked) {
  console.log(`Blocked: ${decision.reason}`);
}

// When shutting down:
firewall.stop();
```

### Config Reference (for README)
```typescript
// FirewallConfig
{
  sources: BlocklistSource[];    // Required. Blocklist URLs to fetch.
  allow?: string[];              // Domains never blocked (exact match).
  deny?: string[];               // Domains always blocked (exact match).
  refreshMinutes?: number;       // Auto-refresh interval. Omit to disable.
  log?: (level: 'warn' | 'error', message: string) => void;  // Custom logger.
}

// BlocklistSource
{
  id: string;                    // Identifier for this source.
  url: string;                   // HTTP(S) URL to fetch.
  format: 'hosts' | 'domains';  // Parse format.
}

// BlockDecision (returned by isDomainBlocked)
{
  blocked: boolean;
  reason?: 'custom-deny' | 'blocklist';
  listId?: string;               // Source ID when blocked by blocklist.
}
```

### Edge Case Test Pattern (for new tests)
```typescript
// Follow existing pattern: describe grouped by requirement
describe('parseHostsFormat edge cases (QUAL-01)', () => {
  it('handles tab-separated fields', () => {
    expect(parseHostsFormat('0.0.0.0\tad.com')).toEqual(['ad.com']);
  });

  it('handles whitespace-only lines', () => {
    expect(parseHostsFormat('   \t  \n0.0.0.0 ad.com')).toEqual(['ad.com']);
  });
});
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUAL-01 | Hosts-format and domain-list parsing edge cases | unit | `npx vitest run tests/parse.test.ts -x` | Yes -- needs additions |
| QUAL-02 | Suffix matching correctness | unit | `npx vitest run tests/match.test.ts -x` | Yes -- needs minor additions |
| QUAL-03 | Allow/deny precedence logic | unit | `npx vitest run tests/decide.test.ts -x` | Yes -- needs minor additions |
| QUAL-04 | README content | manual-only | N/A (human review of README.md) | No -- README is empty |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green + README exists with required sections

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. No new test files, config, or fixtures needed. Work is additive (new `describe` blocks in existing files) plus README creation.

## README Content Plan

Based on QUAL-04, the README needs these sections:

1. **Pitch** (1-2 sentences): Derive from PROJECT.md core value -- "Before your agent calls fetch()..."
2. **Quick Start**: Install + 5-line working example using `PRESET_STEVENBLACK_UNIFIED`
3. **Config Reference**: Document `FirewallConfig`, `BlocklistSource`, `BlockDecision`, presets
4. **What This Is / What This Isn't**: Draw directly from PROJECT.md "Out of Scope" table

Key facts for README:
- Package name: `agent-dns-firewall`
- Entry point: `./dist/index.js` (ESM only)
- Node 18+ required (uses native `fetch`)
- Zero runtime dependencies
- Exports: `createDomainFirewall`, `PRESET_STEVENBLACK_UNIFIED`, `PRESET_HAGEZI_LIGHT`, types
- License: MIT

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: all source files in `src/`, all test files in `tests/`
- `package.json`: version, dependencies, scripts
- `vitest.config.ts`: test configuration
- `tsconfig.json`: TypeScript configuration

### Secondary (MEDIUM confidence)
- None needed -- this phase is entirely about the existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vitest already installed and working with 100 passing tests
- Architecture: HIGH - test patterns and project structure fully understood from source
- Pitfalls: HIGH - derived from concrete codebase analysis (ESM-only, API surface)
- Test gaps: HIGH - line-by-line comparison of requirements vs existing tests

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable -- no external dependencies to drift)
