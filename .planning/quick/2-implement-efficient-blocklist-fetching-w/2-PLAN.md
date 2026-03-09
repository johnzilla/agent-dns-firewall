---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/fetch.ts
  - tests/fetch.test.ts
autonomous: true
requirements: [QUICK-2]

must_haves:
  truths:
    - "Subsequent fetches send If-None-Match and/or If-Modified-Since headers when available"
    - "304 Not Modified responses reuse cached domain list without re-downloading"
    - "First fetch (no cache) works identically to current behavior"
    - "Cache entries are keyed per source URL"
  artifacts:
    - path: "src/fetch.ts"
      provides: "Conditional fetch with ETag/Last-Modified caching"
      exports: ["fetchSource", "fetchAllSources"]
    - path: "tests/fetch.test.ts"
      provides: "Tests for conditional fetching and 304 handling"
  key_links:
    - from: "src/fetch.ts"
      to: "global fetch"
      via: "If-None-Match / If-Modified-Since request headers"
      pattern: "headers.*If-None-Match|If-Modified-Since"
---

<objective>
Add conditional HTTP fetching (ETag / If-Modified-Since) to blocklist downloads so refresh cycles skip re-downloading unchanged lists.

Purpose: Reduce bandwidth, speed up refreshes, respect blocklist provider servers.
Output: Modified fetch.ts with per-URL caching of ETag/Last-Modified, tests proving 304 handling.
</objective>

<execution_context>
@/home/john/.claude/get-shit-done/workflows/execute-plan.md
@/home/john/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/fetch.ts
@src/types.ts
@src/firewall.ts
@tests/fetch.test.ts
</context>

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/types.ts:
```typescript
export interface BlocklistSource {
  id: string;
  url: string;
  format: 'hosts' | 'domains';
}
```

From src/fetch.ts (current signatures to preserve):
```typescript
export async function fetchSource(source: BlocklistSource, signal: AbortSignal): Promise<string[]>
export async function fetchAllSources(sources: BlocklistSource[], signal: AbortSignal, log: (level: 'warn' | 'error', message: string) => void): Promise<Array<{ index: Set<string>; sourceId: string }>>
```

From src/firewall.ts (caller context -- fetchAllSources is called during start() and scheduleRefresh()):
- start() calls fetchAllSources and assigns result to blocklistEntries
- scheduleRefresh() calls fetchAllSources and swaps only if entries.length > 0
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add conditional fetch with ETag/Last-Modified cache to fetchSource</name>
  <files>src/fetch.ts, tests/fetch.test.ts</files>
  <behavior>
    - Test: First fetch for a URL sends no conditional headers, returns parsed domains as before
    - Test: When response includes ETag header, subsequent fetch for same URL sends If-None-Match header with that ETag value
    - Test: When response includes Last-Modified header, subsequent fetch for same URL sends If-Modified-Since header with that value
    - Test: When response includes both ETag and Last-Modified, both conditional headers are sent on next request
    - Test: When server returns 304 Not Modified, fetchSource returns the previously cached domain list without calling response.text()
    - Test: When server returns 200 after a prior cached response, the new data replaces the cache (cache is updated)
    - Test: Different source URLs maintain independent cache entries
    - Test: fetchAllSources still returns correct results when some sources return 304 and others return 200
    - Test: fetchAllSources handles a mix of 304s, 200s, and failures correctly
  </behavior>
  <action>
**In src/fetch.ts:**

1. Add a module-level cache Map at the top of the file:
```typescript
interface CacheEntry {
  etag?: string;
  lastModified?: string;
  domains: string[];
}

const sourceCache = new Map<string, CacheEntry>();
```

2. Modify `fetchSource` to use conditional fetching:
   - Before calling fetch(), check `sourceCache` for the URL
   - If a cache entry exists, build a Headers object with `If-None-Match` (from etag) and/or `If-Modified-Since` (from lastModified)
   - Pass these headers in the fetch options alongside the existing signal
   - After fetch, if `response.status === 304`, return `cached.domains` (the cached domain list)
   - If response is 200 OK, parse as before, then update the cache entry with `response.headers.get('etag')`, `response.headers.get('last-modified')`, and the parsed domains
   - If response is not OK and not 304, throw as before (existing error handling)
   - The function signature remains `Promise<string[]>` -- callers are unaffected

3. Do NOT change `fetchAllSources` -- it already works correctly since `fetchSource` still returns `Promise<string[]>`. A 304 just returns cached data transparently.

4. Export a `clearSourceCache` function for testing purposes:
```typescript
export function clearSourceCache(): void {
  sourceCache.clear();
}
```

**In tests/fetch.test.ts:**

5. Add a new `describe('conditional fetching')` block with tests for the behaviors listed above. Use `vi.stubGlobal('fetch', ...)` with mock responses that include `headers` with a `get(name)` method returning ETag/Last-Modified values. Call `clearSourceCache()` in `beforeEach` to isolate tests.

Mock response shape for tests with headers:
```typescript
{
  ok: true,
  status: 200,
  text: () => Promise.resolve('malware.test\n'),
  headers: { get: (name: string) => name === 'etag' ? '"abc123"' : null },
}
```

For 304 responses:
```typescript
{
  ok: false,  // 304 is not "ok" per fetch spec
  status: 304,
  text: () => Promise.resolve(''),
  headers: { get: () => null },
}
```

Note: `response.ok` is false for 304 -- update the error-throw logic to only throw when `!response.ok && response.status !== 304`.
  </action>
  <verify>
    <automated>cd /home/john/vault/projects/github.com/agent-dns-firewall && npx vitest run tests/fetch.test.ts</automated>
  </verify>
  <done>
    - fetchSource sends conditional headers on repeat requests for the same URL
    - 304 responses return cached domains without re-downloading
    - First requests and new 200 responses work identically to before
    - All existing tests continue to pass
    - New tests cover conditional fetch, 304 handling, cache isolation, and mixed scenarios in fetchAllSources
  </done>
</task>

</tasks>

<verification>
- `npx vitest run` -- all tests pass (existing + new conditional fetch tests)
- `npx tsc --noEmit` -- no type errors
</verification>

<success_criteria>
- Conditional fetch headers (If-None-Match, If-Modified-Since) are sent when cache data exists for a URL
- 304 responses return cached domain lists without re-parsing
- No changes to public API surface (fetchSource/fetchAllSources signatures unchanged)
- All existing tests pass unchanged
- New tests cover conditional fetch behavior
</success_criteria>

<output>
After completion, create `.planning/quick/2-implement-efficient-blocklist-fetching-w/2-SUMMARY.md`
</output>
