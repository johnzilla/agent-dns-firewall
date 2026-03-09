---
phase: quick
plan: 3
type: execute
wave: 1
depends_on: []
files_modified:
  - src/fetch.ts
  - src/firewall.ts
  - tests/fetch.test.ts
  - tests/firewall.test.ts
autonomous: true
requirements: [ENCAPSULATION]

must_haves:
  truths:
    - "Each firewall instance owns its own source cache, no shared global state"
    - "Stopping a firewall instance makes its cache eligible for garbage collection"
    - "Conditional fetching (ETag/Last-Modified/304) still works per-instance"
    - "No module-level mutable state remains in fetch.ts"
  artifacts:
    - path: "src/fetch.ts"
      provides: "fetchSource and fetchAllSources accepting cache as parameter"
      contains: "cache: Map<string, CacheEntry>"
    - path: "src/firewall.ts"
      provides: "sourceCache created inside createDomainFirewall closure"
      contains: "new Map<string, CacheEntry>"
  key_links:
    - from: "src/firewall.ts"
      to: "src/fetch.ts"
      via: "passes sourceCache map into fetchAllSources"
      pattern: "fetchAllSources.*sourceCache"
---

<objective>
Move the module-level sourceCache Map from fetch.ts into the createDomainFirewall closure so each firewall instance owns its own cache. This restores full instance encapsulation -- when stop() is called and references are dropped, the cache is garbage collected with the instance.

Purpose: Eliminate shared global mutable state that breaks instance independence.
Output: Refactored fetch.ts and firewall.ts with per-instance cache ownership, updated tests.
</objective>

<execution_context>
@/home/john/.claude/get-shit-done/workflows/execute-plan.md
@/home/john/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/fetch.ts
@src/firewall.ts
@src/types.ts
@tests/fetch.test.ts
@tests/firewall.test.ts
</context>

<interfaces>
<!-- Current signatures that will change -->

From src/fetch.ts:
```typescript
interface CacheEntry {
  etag?: string;
  lastModified?: string;
  domains: string[];
}

// REMOVE: module-level sourceCache and clearSourceCache export
export function fetchSource(source: BlocklistSource, signal: AbortSignal): Promise<string[]>;
export function fetchAllSources(sources: BlocklistSource[], signal: AbortSignal, log: (level: 'warn' | 'error', message: string) => void): Promise<Array<{ index: Set<string>; sourceId: string }>>;
```

From src/firewall.ts:
```typescript
// createDomainFirewall closure already has: blocklistEntries, refreshTimer, abortController
// Will add: sourceCache Map<string, CacheEntry>
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add cache parameter to fetch functions and remove global state</name>
  <files>src/fetch.ts</files>
  <action>
In src/fetch.ts:

1. Export the CacheEntry interface (so firewall.ts can reference the type when creating the Map).

2. Remove the module-level `const sourceCache = new Map<string, CacheEntry>()` line.

3. Remove the `clearSourceCache()` export entirely.

4. Add a `cache: Map<string, CacheEntry>` parameter to `fetchSource`:
   - New signature: `fetchSource(source: BlocklistSource, signal: AbortSignal, cache: Map<string, CacheEntry>): Promise<string[]>`
   - Replace all `sourceCache` references inside the function body with `cache`

5. Add a `cache: Map<string, CacheEntry>` parameter to `fetchAllSources`:
   - New signature: `fetchAllSources(sources: BlocklistSource[], signal: AbortSignal, log: (...) => void, cache: Map<string, CacheEntry>): Promise<Array<{...}>>`
   - Pass `cache` through to `fetchSource(source, signal, cache)` in the sources.map call

No other logic changes. The conditional fetching behavior (ETag, Last-Modified, 304 handling) remains identical -- only the cache storage location changes from module-global to caller-provided.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>fetch.ts has no module-level mutable state, CacheEntry is exported, both functions accept cache parameter, clearSourceCache is gone</done>
</task>

<task type="auto">
  <name>Task 2: Create per-instance cache in firewall closure and update tests</name>
  <files>src/firewall.ts, tests/fetch.test.ts, tests/firewall.test.ts</files>
  <action>
In src/firewall.ts:

1. Import `CacheEntry` type from './fetch.js': `import type { CacheEntry } from './fetch.js';` (add to existing import)

2. Inside `createDomainFirewall`, after the existing `let abortController` declaration, add:
   `const sourceCache = new Map<string, CacheEntry>();`

3. Update both `fetchAllSources` call sites (in `start()` and in `scheduleRefresh()`) to pass `sourceCache` as the last argument:
   `fetchAllSources(config.sources, abortController.signal, log, sourceCache)`

No changes to stop() needed -- when the closure is garbage collected, sourceCache goes with it. No changes to the DomainFirewall interface.

In tests/fetch.test.ts:

1. Remove all imports of `clearSourceCache`.

2. Create a local cache Map in each describe block or test that needs one:
   `const cache = new Map<string, CacheEntry>();`
   Import CacheEntry from '../src/fetch.js'.

3. Pass `cache` as the last argument to every `fetchSource(...)` and `fetchAllSources(...)` call.

4. Replace every `clearSourceCache()` call in beforeEach with creating a fresh `cache = new Map()` (use `let cache` at describe scope, reassign in beforeEach).

5. In the 'conditional fetching' describe block, the cache must persist across sequential fetchSource calls within the same test (same Map instance), but be fresh between tests (new Map in beforeEach). This preserves the existing test semantics exactly.

In tests/firewall.test.ts:

1. Remove the `import { clearSourceCache } from '../src/fetch.js'` line entirely.

2. Remove every `clearSourceCache()` call from beforeEach hooks. The cache is now per-instance inside the closure, so creating a new firewall via `createDomainFirewall(...)` automatically gets a fresh cache. No manual clearing needed.
  </action>
  <verify>
    <automated>cd /home/john/vault/projects/github.com/agent-dns-firewall && npx vitest run 2>&1 | tail -20</automated>
  </verify>
  <done>All tests pass, no test imports clearSourceCache, firewall.ts creates sourceCache inside closure, each createDomainFirewall call produces an independent instance with its own cache</done>
</task>

</tasks>

<verification>
- `npx vitest run` -- all tests pass
- `npx tsc --noEmit` -- no type errors
- `grep -r "clearSourceCache" src/ tests/` -- returns no results
- `grep -n "^const sourceCache\|^let sourceCache" src/fetch.ts` -- returns no results (no module-level cache)
- `grep -n "sourceCache" src/firewall.ts` -- shows cache created inside createDomainFirewall
</verification>

<success_criteria>
- Zero module-level mutable state in fetch.ts
- CacheEntry type exported from fetch.ts
- sourceCache Map created inside createDomainFirewall closure alongside blocklistEntries and refreshTimer
- fetchSource and fetchAllSources accept cache as a parameter
- clearSourceCache function no longer exists anywhere
- All existing tests pass with updated signatures
- No changes to the public DomainFirewall interface
</success_criteria>

<output>
After completion, create `.planning/quick/3-refactor-cache-state-into-firewall-insta/3-SUMMARY.md`
</output>
