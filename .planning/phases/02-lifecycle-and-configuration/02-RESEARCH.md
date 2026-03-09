# Phase 2: Lifecycle and Configuration - Research

**Researched:** 2026-03-08
**Domain:** HTTP fetching, lifecycle management, factory pattern, timer-based refresh
**Confidence:** HIGH

## Summary

Phase 2 bridges Phase 1's pure functions into a usable library by adding HTTP fetching, a factory API (`createDomainFirewall`), lifecycle management (start/stop), periodic refresh, and preset configurations. The implementation is straightforward Node.js/TypeScript -- native `fetch` for HTTP, `AbortController` for cancellation, `setTimeout` chains for refresh, and closure-based state for the factory return object.

The existing codebase provides all the building blocks: `parseHostsFormat`/`parseDomainList` for content parsing, `buildDomainIndex` for Set creation, and `isDomainBlocked` for query answering. Phase 2 orchestrates these into a stateful wrapper. The types (`FirewallConfig`, `DomainFirewall`, `BlocklistSource`) are already defined and match the required API shape exactly, needing only a `log` callback addition.

**Primary recommendation:** Implement as a single `createDomainFirewall` factory function using closure-based state (no classes). Use native `fetch` with `AbortSignal.timeout()` for HTTP requests and `setTimeout` chains (not `setInterval`) for periodic refresh. Test with `vi.fn()` mocks on `globalThis.fetch` and `vi.useFakeTimers()` for timer behavior.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Always start successfully, even if some or all sources fail to fetch
- No retry logic -- fail immediately on network error, log warning, move to next source
- If all sources fail (zero data), isDomainBlocked() still works -- returns not-blocked
- isDomainBlocked() works before start() is called -- returns not-blocked (no data loaded yet)
- Atomic swap: fetch all sources into a new index, then replace old index in a single assignment
- On refresh failure, keep serving from last successful load (stale > none)
- stop() uses AbortController to cancel in-flight HTTP requests -- clean shutdown, no dangling promises
- start() is idempotent -- calling again re-fetches everything and resets refresh timers
- Optional `log` callback in config: `(level: 'warn' | 'error', message: string) => void`
- Defaults to console.warn/console.error if no callback provided
- Two levels only: 'warn' and 'error'; only log failures
- Log messages include source ID and error details
- Exported constants: `PRESET_STEVENBLACK_UNIFIED` and `PRESET_HAGEZI_LIGHT`
- Each preset is a complete `BlocklistSource` object with id, url, and format pre-configured
- Users compose via array spread: `sources: [PRESET_STEVENBLACK_UNIFIED, ...custom]`
- No convenience wrappers or zero-config defaults

### Claude's Discretion
- Internal fetch implementation details (timeout values, response validation)
- How to structure the factory function internals (closure vs class)
- Refresh timer implementation (setInterval vs setTimeout chain)
- Whether to add `log` to `FirewallConfig` type or extend it

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PARSE-03 | Fetch blocklists from HTTP(S) URLs using native fetch | Native fetch + AbortController patterns documented below |
| LIFE-01 | `createDomainFirewall(config)` returns DomainFirewall with start/stop/isDomainBlocked | Factory pattern with closure-based state |
| LIFE-02 | `start()` fetches all configured sources and populates in-memory blocklist | Parallel fetch with Promise.allSettled, parse, build index pipeline |
| LIFE-03 | `stop()` clears refresh timers and cleans up resources | AbortController.abort() + clearTimeout |
| LIFE-04 | Periodic re-fetch with atomic swap (no vulnerability window) | setTimeout chain + single-assignment swap pattern |
| RESL-01 | Failed source URL logs warning and continues with successful sources | Promise.allSettled + log callback |
| CONF-01 | PRESET_STEVENBLACK_UNIFIED preset | StevenBlack raw URL verified |
| CONF-02 | PRESET_HAGEZI_LIGHT preset | Hagezi light domain list URL verified |
| CONF-03 | Users combine sources, allow/deny, and refresh interval via FirewallConfig | Existing type + log callback addition |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native fetch | Built-in (Node 18+) | HTTP requests for blocklists | No dependencies needed; project targets ES2022 |
| AbortController | Built-in | Cancel in-flight requests on stop() | Native API, no library needed |
| AbortSignal.timeout() | Built-in | Per-request timeout | Cleaner than manual setTimeout+abort |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.0.18 | Test framework (already installed) | All tests |
| vi.useFakeTimers() | Built-in vitest | Test periodic refresh without real delays | Timer-related tests |
| vi.fn() | Built-in vitest | Mock globalThis.fetch | HTTP fetch tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native fetch | node-fetch, undici | Extra dependency; native fetch is sufficient for simple GET requests |
| vi.fn() mock | vitest-fetch-mock, msw | Extra dev dependency; simple vi.fn() is adequate for GET-only fetch mocking |
| setTimeout chain | setInterval | setInterval can drift and doesn't account for fetch duration; setTimeout chain is safer |

**Installation:**
```bash
# No new dependencies needed -- everything is built-in or already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  types.ts          # Add log callback to FirewallConfig (or new extended type)
  presets.ts         # NEW: PRESET_STEVENBLACK_UNIFIED, PRESET_HAGEZI_LIGHT constants
  fetch.ts           # NEW: fetchBlocklistSource() -- fetch + parse + error handling
  firewall.ts        # NEW: createDomainFirewall() factory function
  index.ts           # Add exports for createDomainFirewall, presets
```

### Pattern 1: Closure-Based Factory
**What:** `createDomainFirewall` returns an object literal with methods that close over mutable state variables.
**When to use:** When the "class" has a small surface area (3 methods) and internal state is simple.
**Why chosen (Claude's discretion):** Simpler than a class, naturally encapsulates state, aligns with the functional style of Phase 1.

```typescript
export function createDomainFirewall(config: FirewallConfig): DomainFirewall {
  // Mutable state in closure
  let blocklistEntries: Array<{ index: Set<string>; sourceId: string }> = [];
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;

  const allowSet = buildDomainIndex(config.allow ?? []);
  const denySet = buildDomainIndex(config.deny ?? []);

  const log = config.log ?? defaultLog;

  async function start(): Promise<void> { /* ... */ }
  function stop(): void { /* ... */ }
  function isDomainBlockedFn(domain: string): BlockDecision { /* ... */ }

  return { start, stop, isDomainBlocked: isDomainBlockedFn };
}
```

### Pattern 2: Atomic Swap for Refresh
**What:** Build a complete new blocklist array, then replace the old one in a single assignment.
**When to use:** Always during refresh -- ensures no partial state visible to callers.

```typescript
// During refresh or initial load:
const newEntries = await fetchAllSources(config.sources, abortController.signal, log);
// Single assignment = atomic swap (JS is single-threaded)
blocklistEntries = newEntries;
```

### Pattern 3: setTimeout Chain (not setInterval)
**What:** After each refresh completes, schedule the next one with setTimeout.
**When to use:** For periodic refresh where you want consistent gaps between completions.
**Why chosen (Claude's discretion):** Prevents overlapping fetches if a refresh takes longer than the interval. More predictable behavior.

```typescript
function scheduleRefresh(): void {
  if (!config.refreshMinutes) return;
  refreshTimer = setTimeout(async () => {
    await doRefresh();
    scheduleRefresh(); // Chain next
  }, config.refreshMinutes * 60_000);
}
```

### Pattern 4: AbortController for Clean Shutdown
**What:** Create a new AbortController for each start() cycle; pass its signal to every fetch call; abort on stop().
**When to use:** Every fetch operation must accept the abort signal.

```typescript
function stop(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}
```

### Pattern 5: Per-Request Timeout with AbortSignal.any()
**What:** Combine the lifecycle AbortController signal with a per-request timeout signal.
**When to use:** Each individual fetch should have a timeout (recommendation: 30 seconds) AND respect the global stop() signal.
**Claude's discretion:** 30-second timeout per request is reasonable for large blocklist files.

```typescript
async function fetchSource(source: BlocklistSource, signal: AbortSignal): Promise<string[]> {
  const response = await fetch(source.url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  const content = await response.text();
  return source.format === 'hosts' ? parseHostsFormat(content) : parseDomainList(content);
}
```

### Anti-Patterns to Avoid
- **setInterval for refresh:** Can cause overlapping fetches if fetch takes longer than interval; use setTimeout chain instead.
- **Throwing on fetch failure:** Violates "never throws" contract and "always start successfully" decision. Use Promise.allSettled and filter.
- **Mutating blocklist entries during fetch:** Creates vulnerability window. Always build complete new array, then swap.
- **Forgetting to abort on stop():** Leaves dangling HTTP requests and unresolved promises.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP fetching | Custom HTTP client | Native `fetch()` | Built-in, handles redirects, HTTPS, compression |
| Request cancellation | Manual promise tracking | `AbortController` | Standard API, integrates with fetch natively |
| Request timeout | setTimeout + manual abort | `AbortSignal.timeout(ms)` | Built-in, throws proper TimeoutError |
| Signal combination | Custom logic | `AbortSignal.any()` | Combines lifecycle + timeout signals cleanly |

**Key insight:** All I/O primitives needed are built into Node.js 18+. Zero external dependencies for this phase.

## Common Pitfalls

### Pitfall 1: Response Body Not Consumed Before Abort
**What goes wrong:** If you abort a fetch after getting the response object but before calling `.text()`, the body stream errors.
**Why it happens:** Abort signal cancels the underlying connection, including unread body.
**How to avoid:** Call `response.text()` immediately after checking `response.ok`. The abort signal will reject `fetch()` itself if triggered during the request phase.
**Warning signs:** Unhandled rejection errors during stop() while a refresh is in progress.

### Pitfall 2: Timer Leak on Re-start
**What goes wrong:** Calling `start()` twice without `stop()` creates duplicate refresh timers.
**Why it happens:** First timer is never cleared.
**How to avoid:** Make start() idempotent -- call stop() internally at the beginning of start() to clear any existing state.
**Warning signs:** Multiple concurrent refresh cycles, increasing memory usage.

### Pitfall 3: Stale AbortController Reference
**What goes wrong:** Creating a new AbortController in start() but not aborting the old one first.
**Why it happens:** Previous fetch operations still reference the old controller.
**How to avoid:** In start(), abort the previous controller before creating a new one (which stop() already does).
**Warning signs:** Old fetch operations completing and overwriting new data.

### Pitfall 4: Testing Async Timers
**What goes wrong:** Fake timers don't automatically resolve pending promises.
**Why it happens:** `vi.advanceTimersByTime()` advances timers but async callbacks need microtask flushing.
**How to avoid:** Use `await vi.advanceTimersByTimeAsync()` which handles both timer advancement and promise resolution.
**Warning signs:** Tests timing out or assertions running before async refresh completes.

### Pitfall 5: Empty Blocklist After Total Failure
**What goes wrong:** Not a bug -- but developers might think zero loaded sources is an error state.
**Why it happens:** All sources fail to fetch.
**How to avoid:** This is expected behavior per user decisions. isDomainBlocked() returns not-blocked. Log warnings for each failed source.
**Warning signs:** N/A -- working as designed.

## Code Examples

### Preset Constants
```typescript
// src/presets.ts
import type { BlocklistSource } from './types.js';

export const PRESET_STEVENBLACK_UNIFIED: BlocklistSource = {
  id: 'stevenblack-unified',
  url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
  format: 'hosts',
};

export const PRESET_HAGEZI_LIGHT: BlocklistSource = {
  id: 'hagezi-light',
  url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/light.txt',
  format: 'domains',
};
```

### Log Callback Type Addition
```typescript
// Addition to FirewallConfig in types.ts
export interface FirewallConfig {
  sources: BlocklistSource[];
  allow?: string[];
  deny?: string[];
  refreshMinutes?: number;
  log?: (level: 'warn' | 'error', message: string) => void;
}
```

### Default Logger
```typescript
function defaultLog(level: 'warn' | 'error', message: string): void {
  if (level === 'error') {
    console.error(message);
  } else {
    console.warn(message);
  }
}
```

### Fetch All Sources with Error Isolation
```typescript
async function fetchAllSources(
  sources: BlocklistSource[],
  signal: AbortSignal,
  log: (level: 'warn' | 'error', message: string) => void,
): Promise<Array<{ index: Set<string>; sourceId: string }>> {
  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const domains = await fetchSource(source, signal);
      return { index: buildDomainIndex(domains), sourceId: source.id };
    }),
  );

  const entries: Array<{ index: Set<string>; sourceId: string }> = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      entries.push(result.value);
    } else {
      log('warn', `Failed to fetch source '${sources[i].id}': ${result.reason?.message ?? result.reason}`);
    }
  }
  return entries;
}
```

### Test Pattern: Mocking Fetch
```typescript
// tests/firewall.test.ts
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchResponse(body: string, ok = true, status = 200): void {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status,
    statusText: ok ? 'OK' : 'Service Unavailable',
    text: () => Promise.resolve(body),
  });
}
```

### Test Pattern: Fake Timers for Refresh
```typescript
it('refreshes on schedule', async () => {
  vi.useFakeTimers();
  mockFetchResponse('0.0.0.0 initial.test\n');

  const firewall = createDomainFirewall({
    sources: [{ id: 'test', url: 'https://example.com/hosts', format: 'hosts' }],
    refreshMinutes: 60,
  });

  await firewall.start();
  expect(firewall.isDomainBlocked('initial.test').blocked).toBe(true);

  // Set up next fetch response
  mockFetchResponse('0.0.0.0 refreshed.test\n');

  // Advance past refresh interval
  await vi.advanceTimersByTimeAsync(60 * 60_000);

  expect(firewall.isDomainBlocked('refreshed.test').blocked).toBe(true);

  firewall.stop();
  vi.useRealTimers();
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node-fetch` package | Native `fetch()` | Node 18 (2022) | No external dependency needed |
| Manual setTimeout+abort | `AbortSignal.timeout(ms)` | Node 18+ | Cleaner timeout handling |
| Single signal per fetch | `AbortSignal.any([...signals])` | Node 20+ | Combine lifecycle + timeout signals |
| `vi.advanceTimersByTime()` | `vi.advanceTimersByTimeAsync()` | Vitest 0.35+ | Properly handles async timer callbacks |

**Note on compatibility:** The project targets ES2022 and uses Node.js native fetch. `AbortSignal.any()` requires Node 20+. If Node 18 support is needed, fall back to manually linking timeout to the lifecycle controller. Given the project's modern tooling (Vitest 4, TS 5.9), Node 20+ is a safe assumption.

## Open Questions

1. **Node.js minimum version**
   - What we know: Project targets ES2022, uses Vitest 4, TypeScript 5.9
   - What's unclear: Whether Node 18 or Node 20 is the minimum target
   - Recommendation: Use `AbortSignal.any()` (Node 20+). If Node 18 is required, this is a simple fallback to manual abort linking. The rest of the API works on Node 18+.

2. **Fetch timeout value**
   - What we know: User left this to Claude's discretion
   - Recommendation: 30 seconds per request. Blocklist files can be large (StevenBlack is ~2.5MB) but should download in well under 30s on any reasonable connection.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/firewall.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARSE-03 | Fetch blocklists from HTTP(S) URLs | unit (mocked fetch) | `npx vitest run tests/fetch.test.ts -x` | No - Wave 0 |
| LIFE-01 | createDomainFirewall returns object with start/stop/isDomainBlocked | unit | `npx vitest run tests/firewall.test.ts -x` | No - Wave 0 |
| LIFE-02 | start() fetches sources and populates blocklist | unit (mocked fetch) | `npx vitest run tests/firewall.test.ts -x` | No - Wave 0 |
| LIFE-03 | stop() clears timers and aborts in-flight requests | unit (fake timers) | `npx vitest run tests/firewall.test.ts -x` | No - Wave 0 |
| LIFE-04 | Periodic refresh with atomic swap | unit (fake timers + mocked fetch) | `npx vitest run tests/firewall.test.ts -x` | No - Wave 0 |
| RESL-01 | Failed source logs warning, continues with others | unit (mocked fetch) | `npx vitest run tests/firewall.test.ts -x` | No - Wave 0 |
| CONF-01 | PRESET_STEVENBLACK_UNIFIED has correct shape | unit | `npx vitest run tests/presets.test.ts -x` | No - Wave 0 |
| CONF-02 | PRESET_HAGEZI_LIGHT has correct shape | unit | `npx vitest run tests/presets.test.ts -x` | No - Wave 0 |
| CONF-03 | Config combines sources, allow/deny, refresh | unit | `npx vitest run tests/firewall.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/fetch.test.ts` -- covers PARSE-03 (individual source fetching)
- [ ] `tests/firewall.test.ts` -- covers LIFE-01 through LIFE-04, RESL-01, CONF-03
- [ ] `tests/presets.test.ts` -- covers CONF-01, CONF-02

## Sources

### Primary (HIGH confidence)
- Project source code -- `src/types.ts`, `src/parse.ts`, `src/match.ts`, `src/decide.ts`, `src/index.ts`
- [StevenBlack/hosts GitHub](https://github.com/StevenBlack/hosts) -- verified raw URL: `https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts`
- [hagezi/dns-blocklists GitHub](https://github.com/hagezi/dns-blocklists) -- verified raw URL: `https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/light.txt`
- [MDN AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) -- timeout() and any() APIs
- [Vitest Mocking Guide](https://vitest.dev/guide/mocking) -- timer and function mocking

### Secondary (MEDIUM confidence)
- [AppSignal AbortController Guide](https://blog.appsignal.com/2025/02/12/managing-asynchronous-operations-in-nodejs-with-abortcontroller.html) -- patterns and best practices
- [Vitest Timers Guide](https://vitest.dev/guide/mocking/timers) -- fake timer usage

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- native APIs only, no external dependencies, verified against project config
- Architecture: HIGH -- patterns are well-established (factory, closure state, Promise.allSettled, atomic swap)
- Pitfalls: HIGH -- derived from direct code analysis and known async/timer testing issues
- Preset URLs: HIGH -- verified against current GitHub repositories

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable domain, no fast-moving dependencies)
