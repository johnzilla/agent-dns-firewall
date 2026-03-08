# Technology Stack

**Project:** agent-dns-firewall
**Researched:** 2026-03-08
**Overall confidence:** MEDIUM (versions from training data, could not verify against npm registry)

## Constraints Driving Stack Decisions

The PROJECT.md specifies three hard constraints that collapse most decisions:

1. **Zero runtime dependencies** -- no lodash, no external trie libraries, no HTTP clients beyond Node built-ins
2. **ESM-only** -- `"type": "module"`, no CJS dual-build
3. **Node 18+ baseline** -- `fetch()` is globally available (for blocklist downloading), no polyfills needed

This means the stack is entirely about **dev tooling** -- build, test, lint, types. The runtime code is pure TypeScript with zero `node_modules` at install time.

## Recommended Stack

### Language & Runtime

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| TypeScript | ~5.7 | Type safety, API contracts | Industry standard; strict mode catches domain-handling edge cases at compile time | MEDIUM (verify latest) |
| Node.js | >=18.0.0 | Runtime target | 18+ gives us global `fetch()`, `AbortController`, `URL`, and stable ESM support -- everything needed without polyfills | HIGH |

### Build Tool

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| tsup | ~8.x | Bundle to ESM `.js` output | Built on esbuild, zero-config for single-format library builds. One command: `tsup src/index.ts --format esm --dts`. Generates `.js` + `.d.ts` in seconds. The standard choice for small-to-mid TypeScript libraries in 2025. | MEDIUM (verify latest) |

**Why tsup over alternatives:**

- **tsc only**: No bundling. You'd ship the full `src/` directory structure. Works for simple cases but tsup gives you a clean single-entry bundle with tree-shaking and `.d.ts` generation in one step.
- **unbuild**: More opinionated (Nuxt ecosystem), auto-infers config from `package.json`. Good tool but tsup has broader community adoption for standalone libraries.
- **rollup**: Lower-level, requires plugins for TypeScript. Overkill for a single-entry library.
- **esbuild directly**: Fast but no `.d.ts` generation. You'd need a separate `tsc --emitDeclarationOnly` step. tsup wraps this for you.
- **Vite library mode**: Designed for frontend apps. Unnecessary abstraction for a Node library.

### Test Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| vitest | ~3.x | Unit & integration tests | Native ESM support, native TypeScript support (no ts-jest config), fast watch mode, compatible API with Jest but none of Jest's ESM pain. The standard for new TypeScript projects since 2024. | MEDIUM (verify latest) |

**Why vitest over alternatives:**

- **Jest**: ESM support is still experimental and fragile. Requires `ts-jest` or SWC transformer. Configuration overhead for what should be simple. Jest is legacy for new TypeScript ESM projects.
- **node:test**: Built-in, zero dependencies, but assertion API is basic and no watch mode. Good for ultra-minimal projects but vitest's DX is worth the dev dependency.
- **tap/ava**: Smaller communities, less TypeScript-first support.

### Linter & Formatter

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Biome | ~1.9+ | Lint + format in one tool | Replaces ESLint + Prettier with a single, fast Rust binary. One config file, one command. For a new project with no ESLint plugin dependencies, there is no reason to use the ESLint+Prettier combination anymore. | MEDIUM (verify latest) |

**Why Biome over alternatives:**

- **ESLint + Prettier**: Two tools, two configs, potential conflicts between them. ESLint's new flat config is an improvement but Biome is still simpler. For greenfield with no legacy ESLint plugins needed, Biome wins.
- **ESLint only** (with stylistic rules): Works but Biome's formatter is faster and configuration is easier.
- **dprint**: Good formatter but lacks lint rules. You'd still need ESLint alongside it.

### Dev Runner

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| tsx | ~4.x | Run `.ts` files directly during development | `tsx src/example.ts` for quick manual testing. Uses esbuild under the hood, starts instantly. Not needed for production but invaluable during development. | MEDIUM (verify latest) |

**Why tsx:**

- **ts-node**: Slower startup, more configuration needed, ESM support requires flags.
- **Node --loader**: Experimental, warnings in stderr, configuration burden.
- **tsx**: Just works. `tsx file.ts` and you're running.

### Data Structures (Implemented In-Project, Zero Dependencies)

| Structure | Purpose | Why | Confidence |
|-----------|---------|-----|------------|
| Reversed-label trie | Domain suffix matching | A domain like `sub.malware.example.com` is stored as `["com", "example", "malware", "sub"]` in a trie. To check if a domain is blocked, split on `.`, reverse, walk the trie. If you hit a terminal node before exhausting labels, it's a suffix match. O(k) lookup where k = number of labels (typically 2-5). This is exactly how Pi-hole and AdGuard do it. | HIGH |
| `Map<string, TrieNode>` for trie children | Child node storage | `Map` is the right choice over plain objects for arbitrary string keys. Predictable performance, no prototype chain issues. | HIGH |
| `Set<string>` for allow/deny lists | O(1) exact lookups for small override lists | Allow/deny lists are small (tens to hundreds of entries). A `Set` is perfect -- O(1) lookup, simple API. No need for trie complexity here. | HIGH |

**Why reversed-label trie over alternatives:**

- **HashSet of exact domains**: O(1) lookup but no suffix matching. Blocking `example.com` would NOT block `sub.example.com`. You'd have to enumerate every subdomain, which is impossible.
- **Regex compilation**: Compile all domains into one big regex. Terrible performance at scale (100K+ domains), hard to debug, catastrophic backtracking risk.
- **Sorted array + binary search**: O(log n) lookup, decent, but suffix matching requires awkward string reversal and prefix matching. Trie is cleaner.
- **Radix trie / Patricia trie**: More memory-efficient but more complex to implement. The standard trie with Map children is simple, fast enough for 200K domains, and correct. Optimize later if profiling shows need.
- **Bloom filter**: Probabilistic -- false positives are unacceptable for a security tool. A bloom filter in front of a trie could help for the "not blocked" fast path, but adds complexity for marginal gain at this scale.

### Blocklist Format Parsing (Implemented In-Project)

| Format | Pattern | Parser Approach | Confidence |
|--------|---------|-----------------|------------|
| `hosts` format | `0.0.0.0 domain.com` or `127.0.0.1 domain.com` | Line-by-line: skip `#` comments, skip blank lines, split on whitespace, take second field, normalize. StevenBlack unified list uses this format. | HIGH |
| `domains` format | `domain.com` (one per line) | Line-by-line: skip `#` comments, skip blank lines, trim, normalize. Hagezi lists offer this format. | HIGH |

**Normalization pipeline** (applied to every extracted domain):
1. `trim()` -- remove leading/trailing whitespace
2. `toLowerCase()` -- DNS is case-insensitive
3. Strip trailing `.` -- FQDN notation (`example.com.` -> `example.com`)
4. Validate: must have at least one `.`, no spaces, reasonable length
5. Skip special entries: `localhost`, `local`, `broadcasthost`, `ip6-*`

**Why not use a parsing library:**
- The formats are trivially simple (line-oriented, whitespace-delimited)
- A dependency would violate the zero-runtime-deps constraint
- Custom parser is ~30 lines of code per format
- Full control over edge cases (malformed lines, encoding issues)

## Supporting Libraries (Dev Only)

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `@types/node` | ~22.x | Node.js type definitions | Always -- provides types for `fetch`, `URL`, timers | MEDIUM |

That's it. With zero runtime dependencies, vitest for testing, tsup for building, and Biome for linting, the dev dependency list is minimal.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Build | tsup | tsc-only | No bundling, no single clean output |
| Build | tsup | unbuild | Less community adoption outside Nuxt ecosystem |
| Build | tsup | rollup | Requires plugins, more configuration |
| Test | vitest | jest | ESM support is painful, requires ts-jest |
| Test | vitest | node:test | Weak assertion API, no watch mode |
| Lint | Biome | ESLint+Prettier | Two tools, more config, slower |
| Data structure | Reversed-label trie | HashSet | No suffix matching |
| Data structure | Reversed-label trie | Radix trie | Over-engineered for v1 |
| Runner | tsx | ts-node | Slower, more configuration for ESM |

## Do NOT Use

| Technology | Why Not |
|------------|---------|
| Any runtime dependency (e.g., `node-fetch`, `axios`) | Hard constraint. Node 18+ has global `fetch()`. |
| Any external trie library | Hard constraint. ~100 lines of code, not worth a dependency. |
| Jest | ESM + TypeScript configuration is a recurring headache. Community has moved to vitest. |
| Webpack | Application bundler, not a library bundler. |
| Babel | Unnecessary with esbuild-based tooling (tsup). |
| SWC standalone | Good tool but tsup already uses esbuild and handles everything. |
| Prettier + ESLint combo | Biome does both in one tool, faster, less config. |
| CJS output | PROJECT.md specifies ESM-only. Dual builds add complexity for no value here. |

## Package.json Shape

```jsonc
{
  "name": "agent-dns-firewall",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check .",
    "lint:fix": "biome check --fix .",
    "typecheck": "tsc --noEmit"
  }
}
```

## tsup.config.ts Shape

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node18",
});
```

## Installation

```bash
# Dev dependencies only -- zero runtime deps
npm install -D typescript tsup vitest @biomejs/biome tsx @types/node
```

## Version Verification Note

All version numbers are from training data (cutoff ~May 2025). Before `npm install`, verify latest stable versions:

```bash
npm view typescript version
npm view tsup version
npm view vitest version
npm view @biomejs/biome version
npm view tsx version
```

Use caret ranges (`^`) in `package.json` for all dev dependencies -- these are build tools, not shipping to users.

## Sources

- TypeScript handbook and release notes (typescriptlang.org)
- tsup documentation (tsup.egoist.dev)
- vitest documentation (vitest.dev)
- Biome documentation (biomejs.dev)
- StevenBlack/hosts repository (github.com/StevenBlack/hosts) for hosts format specification
- Hagezi DNS blocklists (github.com/hagezi/dns-blocklists) for domains format specification
- Pi-hole source code for domain matching approach (trie-based suffix matching)
- AdGuard DNS filter engine documentation for trie-based matching validation
