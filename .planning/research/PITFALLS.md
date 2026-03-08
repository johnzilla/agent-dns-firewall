# Domain Pitfalls

**Domain:** DNS blocklist / in-process domain firewall library (TypeScript)
**Researched:** 2026-03-08
**Confidence:** MEDIUM (training data; web verification tools unavailable)

## Critical Pitfalls

Mistakes that cause incorrect blocking, memory blowups, or security gaps.

### Pitfall 1: Hosts File Format Is Messier Than You Think

**What goes wrong:** Parsers assume `0.0.0.0 domain.com` and break on the real-world variations found in StevenBlack, Hagezi, and community lists.

**Why it happens:** The "hosts" format has no formal spec. Real files contain:
- Both `0.0.0.0` and `127.0.0.1` as the IP prefix (and occasionally `::1` for IPv6)
- Inline comments: `0.0.0.0 tracker.example.com # analytics tracker`
- Blank lines, header comment blocks (lines starting with `#`)
- Lines with ONLY a domain (no IP prefix) in some hybrid lists
- Windows-style `\r\n` line endings mixed with Unix `\n`
- Tab characters as separators instead of spaces
- Multiple domains on a single line: `0.0.0.0 domain1.com domain2.com`
- Entries for `localhost`, `broadcasthost`, `local`, `0.0.0.0` itself as domains in preamble blocks

**Consequences:** Missing entries silently (domains not blocked), false positives (blocking `localhost`), or parser crashes on unexpected input.

**Prevention:**
1. Strip inline comments (everything after `#`)
2. Split on any whitespace (`/\s+/`), not just single space
3. Handle both `\r\n` and `\n` line endings
4. Skip lines where the domain part is `localhost`, `broadcasthost`, `local`, `0.0.0.0`, `127.0.0.1`, `::1`, or empty
5. Accept `0.0.0.0`, `127.0.0.1`, and `::1` as valid IP prefixes (or ignore IP entirely and just extract domains)
6. Handle multi-domain lines by extracting all domain tokens after the IP
7. Test with real StevenBlack and Hagezi files, not synthetic test data

**Detection:** Unit tests with edge-case lines. Integration test that fetches a real list and asserts entry count is within expected range (StevenBlack unified is ~170k+ entries).

**Phase relevance:** Core parsing phase -- must be right from the start.

---

### Pitfall 2: Suffix Matching Done Wrong Blocks Too Much or Too Little

**What goes wrong:** Naive suffix matching with string `endsWith` causes false positives. Blocking `example.com` with `.endsWith("example.com")` also blocks `notexample.com` because the string ends with `example.com`.

**Why it happens:** Domain suffix matching requires label-boundary awareness. `sub.example.com` is a subdomain of `example.com`, but `notexample.com` is a completely different domain. String operations don't understand DNS label boundaries (the dots).

**Consequences:** False positives (blocking legitimate domains that happen to share a suffix string) or false negatives (not blocking subdomains because the check is too strict).

**Prevention:**
1. When checking if `hostname` is blocked by `blockedDomain`, verify EITHER exact match OR that `hostname` ends with `.` + `blockedDomain`
2. Normalize: lowercase, strip trailing dot, trim whitespace BEFORE storage and lookup
3. The correct check: `hostname === blocked || hostname.endsWith("." + blocked)`
4. If using a Set for O(1) lookup: walk up the domain hierarchy by splitting on dots and checking each ancestor. For `a.b.example.com`, check `a.b.example.com`, then `b.example.com`, then `example.com`, then `com`.

**Detection:** Test case: block `example.com`, assert `notexample.com` is NOT blocked, assert `sub.example.com` IS blocked.

**Phase relevance:** Core matching logic -- foundational, must be correct before anything else builds on it.

---

### Pitfall 3: Blocking TLDs or Near-TLDs Accidentally

**What goes wrong:** If a blocklist contains entries like `com`, `co.uk`, or `googleapis.com` (which is not a TLD but is extremely broad), suffix matching blocks enormous swaths of the internet.

**Why it happens:** Some community blocklists include overly broad entries. Without guardrails, the library blocks all subdomains of these entries, which can include critical infrastructure domains.

**Consequences:** Agent cannot reach any `.com` domain, or all Google API calls fail, or similar catastrophic over-blocking.

**Prevention:**
1. Consider a warning/log when a blocklist entry has fewer than 2 labels (e.g., just `com` or `net`)
2. Document that allow-list overrides exist for exactly this case
3. The allow-list-first precedence order (`allow > deny > blocklist`) in the project spec already mitigates this -- make sure it is always enforced
4. Consider optional "safety valve" that warns or skips single-label entries from blocklists

**Detection:** Log a warning count after list ingestion showing how many entries are single-label or two-label. Test that allow-list overrides actually work against broad blocklist entries.

**Phase relevance:** Allow/deny override logic phase. This is why allow-list-first is the right default.

---

### Pitfall 4: Memory Explosion with Large Blocklists

**What goes wrong:** StevenBlack unified hosts is ~170k entries. Hagezi full is ~300k+. Storing every entry as a full string in a `Set<string>` uses significant memory, and multiple lists compound the problem.

**Why it happens:** Each string in V8 has ~50-80 bytes of overhead beyond the character data. 300k strings averaging 20 characters each: ~300k * ~100 bytes = ~30MB. With multiple lists and no deduplication, this can reach 100MB+.

**Consequences:** High memory footprint for a "small library." In constrained environments (serverless, edge workers), this becomes a real problem.

**Prevention:**
1. **Deduplicate across lists.** Use a single `Set<string>` for all blocklist entries, not one per list. This eliminates the ~30-50% overlap between popular lists.
2. **Use a Set, not a Trie (for v1).** A `Set<string>` with the "walk up the hierarchy" lookup approach is simpler, fast enough (3-4 lookups per check max), and memory-efficient enough for most use cases. A Trie saves memory at extreme scale but adds complexity.
3. **Stream-parse, don't load entire file into memory.** Process the response body line-by-line (or split by newline after download) rather than building an intermediate array of all lines.
4. **Track and log entry counts** so users know what they're loading.

**Detection:** Benchmark memory usage with `process.memoryUsage()` before and after loading StevenBlack unified. If delta exceeds 50MB, investigate.

**Phase relevance:** Blocklist ingestion phase. Design the data structure correctly from the start; changing it later requires touching every lookup path.

---

### Pitfall 5: Fetch Failures That Silently Break the Firewall

**What goes wrong:** Blocklist URL returns 404, times out, or returns HTML error page instead of a hosts file. The library either crashes, blocks nothing (empty list), or parses the HTML and gets garbage entries.

**Why it happens:** Community blocklist URLs move, GitHub raw URLs change, CDNs have outages. HTTP responses don't always fail cleanly -- a 200 with a Cloudflare challenge page or a redirect to a login page returns HTML that the parser tries to interpret as hosts entries.

**Consequences:** Silent failure = the firewall is "running" but blocking nothing. Or worse, HTML tags get parsed as domains and the firewall blocks random strings.

**Prevention:**
1. **Validate response content-type** or at minimum check that the first non-comment line looks like a hosts/domains entry
2. **Log clearly** when a source fails, including HTTP status and URL
3. **Never throw from `isDomainBlocked`** -- spec already requires this, enforce with tests
4. **Require at least one source to succeed** during `start()`, or emit a warning that the firewall has zero entries
5. **Set reasonable timeouts** on fetch (10-15 seconds per source)
6. **On refresh failure, keep the previous good data** rather than clearing the blocklist

**Detection:** Test with intentionally broken URLs. Assert that `isDomainBlocked` still works (returns not-blocked). Assert that a warning/error is logged.

**Phase relevance:** Blocklist fetching phase. The "graceful failure" requirement in the spec is good -- make sure it's tested thoroughly.

---

### Pitfall 6: Refresh Race Conditions

**What goes wrong:** During a periodic refresh, the old blocklist data is cleared before the new data is fully loaded. For the duration of the fetch+parse (could be several seconds), `isDomainBlocked` returns "not blocked" for everything.

**Why it happens:** Naive implementation: `this.blocklist.clear(); await this.loadSources(); // gap here where blocklist is empty`

**Consequences:** Window of vulnerability during every refresh cycle. If refresh is frequent (e.g., every 30 minutes) and fetches are slow, this creates regular security gaps.

**Prevention:**
1. **Build new Set, then swap atomically.** Load all sources into a NEW `Set<string>`, then replace the reference: `this.blocklist = newBlocklist`. The old set is garbage-collected.
2. **If any source fails during refresh, merge successful results with existing data** rather than replacing entirely. Or keep the old data entirely if all sources fail.
3. **Never mutate the active blocklist in place during refresh.**

**Detection:** Test: start firewall, verify domain is blocked, trigger refresh (with a slow/delayed mock source), verify domain is STILL blocked during the refresh.

**Phase relevance:** Refresh/lifecycle phase. This is easy to get wrong and hard to notice in testing because the window is brief.

---

## Moderate Pitfalls

### Pitfall 7: Not Normalizing Domains Consistently

**What goes wrong:** Domain stored as `Example.COM` in the blocklist, but lookup checks `example.com`. Or trailing dots: `example.com.` vs `example.com`. Mismatch means the domain is not found.

**Prevention:**
1. Normalize at TWO points: when adding to the blocklist AND when checking `isDomainBlocked`
2. Normalization: `hostname.toLowerCase().trim().replace(/\.$/, "")`
3. Write a single `normalizeDomain()` function used by both ingestion and lookup paths
4. Test with mixed-case input on both sides

**Phase relevance:** Core parsing phase. Create the normalize function first and use it everywhere.

---

### Pitfall 8: Timer Leaks on Stop/Cleanup

**What goes wrong:** `setInterval` for refresh is started but never cleared when `stop()` is called. In test environments or short-lived processes, this keeps the process alive and leaks resources.

**Prevention:**
1. Store the interval ID from `setInterval` and call `clearInterval` in `stop()`
2. Use `unref()` on the timer so it doesn't keep the Node.js event loop alive: `timer.unref()`
3. Make `stop()` idempotent -- calling it twice should not throw
4. Cancel any in-flight fetch requests during `stop()` using `AbortController`

**Detection:** Test: call `start()`, then `stop()`, verify the process can exit cleanly (no hanging timer). Vitest/Jest will warn about open handles.

**Phase relevance:** Lifecycle/API phase. Easy to forget `unref()` specifically.

---

### Pitfall 9: Unsafe Domain Names in Input

**What goes wrong:** `isDomainBlocked()` receives unexpected input -- a full URL (`https://example.com/path`), an IP address, `null`, `undefined`, an empty string, or a domain with a port (`example.com:8080`).

**Prevention:**
1. Document clearly that the input is a hostname, not a URL
2. Defensively strip protocol, path, port if present -- or throw a clear error
3. Handle `null`/`undefined`/empty gracefully (return "not blocked" per the no-throw requirement)
4. Consider a lightweight validation: hostname should match `/^[a-z0-9.-]+$/i` after normalization

**Detection:** Test with URLs, IPs, empty strings, null, undefined. All should return a valid `BlockDecision` without throwing.

**Phase relevance:** Public API design phase. Define the contract early.

---

### Pitfall 10: Ignoring the `domains` Format Differences

**What goes wrong:** The project supports both `hosts` format and `domains` format (plain domain list). Using the same parser for both fails because domains format has no IP prefix.

**Prevention:**
1. Require the user to specify the format per source in config (`format: "hosts" | "domains"`)
2. The `hosts` parser extracts domains after the IP prefix; the `domains` parser treats each non-comment line as a domain
3. Do NOT try to auto-detect format -- it's ambiguous (a valid domain like `127.0.0.1.example.com` looks like a hosts line)
4. The presets should encode the correct format for each known list

**Detection:** Test both formats with real-world examples. Test that a domains-format file parsed as hosts-format produces incorrect results (this validates that format matters).

**Phase relevance:** Blocklist ingestion phase. Bake format into the source config type from the start.

---

## Minor Pitfalls

### Pitfall 11: Not Handling IDN / Punycode Domains

**What goes wrong:** International domain names (e.g., `xn--nxasmq6b.com` or `unicodedomain.com`) appear in some blocklists in punycode form. If the lookup uses the unicode form (or vice versa), there's a mismatch.

**Prevention:** For v1, document that domains should be in ASCII/punycode form. Hosts files universally use punycode. If supporting unicode lookup, convert to punycode before checking. Node.js has `url.domainToASCII()` built-in (no dependency needed).

**Phase relevance:** Future enhancement. Not critical for v1 but worth documenting.

---

### Pitfall 12: Preset URLs Going Stale

**What goes wrong:** Hardcoded preset URLs (StevenBlack GitHub raw URL, Hagezi GitHub raw URL) change when repositories restructure or maintainers change hosting.

**Prevention:**
1. Use the most stable URLs available (GitHub raw URLs based on `master`/`main` branch, not tagged releases that may stop updating)
2. Document the preset URLs in the README so users can verify
3. Allow users to override preset URLs in config
4. The graceful-failure design means a stale URL degrades to "no entries from that source" rather than crashing

**Phase relevance:** Preset configuration phase. Keep preset definitions separate from core logic so they're easy to update.

---

### Pitfall 13: Not Testing with Real Lists

**What goes wrong:** All tests use small synthetic data. The parser works perfectly on `0.0.0.0 test.com` but breaks on line 47,382 of StevenBlack's actual file due to an unexpected format variation.

**Prevention:**
1. Have at least one integration test (possibly marked slow/optional) that fetches a real list and validates parsing
2. Keep a small snapshot of real-world edge-case lines as a test fixture
3. Test that entry count after parsing is within a reasonable range of expected (StevenBlack unified: ~130k-200k entries)

**Phase relevance:** Testing phase. Create a fixture file with real edge-case lines early.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Hosts/domains parsing | Format variations, CR/LF, inline comments, multi-domain lines (Pitfalls 1, 10) | Robust parser with comprehensive test fixtures from real lists |
| Domain matching | Suffix false positives on label boundaries (Pitfall 2) | `exact || endsWith("." + blocked)` pattern, explicit test for `notexample.com` |
| Data structure | Memory with large lists (Pitfall 4) | Single deduplicated Set, benchmark memory with real lists |
| Allow/deny logic | TLD/broad-entry over-blocking (Pitfall 3) | Allow-first precedence, warnings on single-label entries |
| Blocklist fetching | Silent failures, HTML error pages (Pitfall 5) | Content validation, keep-previous-on-failure, timeout, logging |
| Refresh lifecycle | Race condition during swap (Pitfall 6), timer leaks (Pitfall 8) | Atomic swap pattern, `unref()` on timers, `AbortController` on stop |
| Public API | Unexpected input types (Pitfall 9) | Defensive normalization, no-throw contract, input validation |
| Presets | Stale URLs (Pitfall 12) | Graceful failure, user-overridable URLs |

## Sources

- Training data knowledge of hosts file format conventions (StevenBlack, Hagezi, Pi-hole ecosystem) -- MEDIUM confidence
- Project requirements from `.planning/PROJECT.md`
- Domain expertise in DNS blocking semantics, Set vs Trie tradeoffs, V8 string memory overhead
- Note: Web search and web fetch tools were unavailable; findings based on training data. Recommend validating real list formats during implementation.
