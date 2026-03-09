# Phase 4: Package Configuration - Research

**Researched:** 2026-03-09
**Domain:** npm package configuration, TypeScript module resolution, package validation
**Confidence:** HIGH

## Summary

Phase 4 transforms the existing library into a correctly shaped npm package. The codebase is already well-positioned: all imports use `.js` extensions (required for `nodenext`), the project is ESM-only with zero runtime dependencies, and `declaration`/`declarationMap` are already enabled in tsconfig. The work is primarily configuration changes to package.json and tsconfig.json, plus installing two validation devDependencies.

The main risk area is the tsconfig `module`/`moduleResolution` switch from `ES2022`/`bundler` to `nodenext`/`nodenext`. This changes how TypeScript validates imports and may surface issues. However, since all source imports already use `.js` extensions and the project has no CJS dependencies, the switch should be clean. One notable tsconfig interaction: `esModuleInterop` defaults to `true` when `module` is `nodenext`, so the explicit `esModuleInterop: false` in the current tsconfig should be removed to avoid overriding the default.

**Primary recommendation:** Make all package.json and tsconfig.json changes in a single task, then validate with `publint` and `attw --pack` in a second task. The changes are small and tightly coupled.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single entrypoint: `"."` maps to `{ types: "./dist/index.d.ts", import: "./dist/index.js" }`
- No subpath exports -- everything via `"agent-dns-firewall"`
- No top-level `main` field -- `exports` only (Node 18+ target)
- Add `"./package.json": "./package.json"` self-reference export for bundler compatibility
- `author`: "johnzilla"
- `keywords`: dns, firewall, blocklist, security, ai-agent, agent, domain-blocking, allowlist, denylist
- `repository`, `homepage`, `bugs` all derived from github.com/johnzilla/agent-dns-firewall
- `version`: "1.0.0"
- `sideEffects`: false
- `engines`: { "node": ">=18" }
- `build`: `rm -rf dist && tsc`
- `check`: `npm run build && publint && attw --pack`
- `prepublishOnly`: `npm run check`
- publint and @arethetypeswrong/cli installed as devDependencies (not npx)
- `files`: ["dist"] -- npm auto-includes LICENSE, README.md, package.json
- Declaration maps (.d.ts.map) included in dist/ for IDE "Go to Source"
- Source maps (.js.map) NOT generated -- remove `sourceMap: true` from tsconfig
- Keep `declarationMap: true` in tsconfig
- `module`: "nodenext" (was "ES2022")
- `moduleResolution`: "nodenext" (was "bundler")

### Claude's Discretion
- Exact publint/attw version pins
- Any additional tsconfig adjustments needed for nodenext compatibility
- Order of fields in package.json

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PKG-01 | package.json `exports` field uses conditional exports with `types` condition first | Conditional exports pattern documented below; `types` must be first condition per Node.js and TypeScript docs |
| PKG-02 | package.json has `types`, `files`, `engines`, `keywords`, `repository`, `homepage`, `bugs`, `author` fields | All field values locked in CONTEXT.md; standard npm metadata |
| PKG-03 | package.json version set to `1.0.0` | Simple field change |
| PKG-04 | package.json has `sideEffects: false` | Simple field addition for tree-shaking |
| PKG-05 | LICENSE file exists in project root | Already exists (MIT) -- no work needed |
| BUILD-01 | tsconfig `moduleResolution` switched to `nodenext` and `module` to `nodenext` | tsconfig changes documented below; `.js` imports already present; `esModuleInterop` handling needed |
| BUILD-02 | `prepublishOnly` script runs build + validation | Script chain: `prepublishOnly` -> `check` -> `build` + `publint` + `attw --pack` |
| VAL-01 | publint installed as dev dependency and validates package structure | publint v0.3.x; install as devDependency |
| VAL-02 | @arethetypeswrong/cli installed as dev dependency and validates type resolution | attw v0.18.x; install as devDependency |
</phase_requirements>

## Standard Stack

### Core (already present)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| typescript | ^5.9.3 | Compilation | Already installed; tsc produces .js + .d.ts + .d.ts.map |
| vitest | ^4.0.18 | Testing | Already installed; must verify tests still pass after tsconfig changes |

### New DevDependencies
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| publint | ^0.3.18 | Package structure validation | De facto standard for validating npm package correctness |
| @arethetypeswrong/cli | ^0.18.2 | Type resolution validation | Standard tool for verifying TypeScript types resolve correctly across all moduleResolution modes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| publint (devDep) | npx publint | User decided: install as devDep, not npx |
| attw (devDep) | npx attw | User decided: install as devDep, not npx |

**Installation:**
```bash
npm install --save-dev publint @arethetypeswrong/cli
```

## Architecture Patterns

### package.json exports (Conditional Exports)

The `exports` field must use conditional exports with `types` first. This is the locked decision:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./package.json": "./package.json"
  }
}
```

**Why `types` first:** TypeScript resolves conditions in order. The `types` condition must appear before `import`/`default` so TypeScript picks up `.d.ts` files. This is required by both TypeScript docs and attw validation.

**Why no `default`:** The package is ESM-only (`"type": "module"`). The `import` condition covers all ESM consumers. There is no CJS build, so no `require` condition. Using `import` instead of `default` is more explicit and attw will validate it correctly.

**Why `./package.json` self-reference:** Some bundlers (e.g., Webpack) need to read package.json for metadata. Without this export, strict `exports` resolution blocks access to package.json.

### tsconfig.json Changes

Current tsconfig needs these specific changes:

```json
{
  "compilerOptions": {
    "module": "nodenext",           // was "ES2022"
    "moduleResolution": "nodenext", // was "bundler"
    // REMOVE: "sourceMap": true
    // REMOVE: "esModuleInterop": false  (defaults to true under nodenext)
  }
}
```

**Critical: `esModuleInterop`** -- When `module` is `nodenext`, TypeScript defaults `esModuleInterop` to `true`. The current tsconfig explicitly sets it to `false`. This must be removed (not set to `true` -- just removed) to accept the correct default. Since the project uses `verbatimModuleSyntax: true`, this is moot for the project's own code (verbatimModuleSyntax supersedes esModuleInterop behavior), but removing the explicit `false` avoids confusing future readers and aligns with TypeScript's nodenext expectations.

**No other changes needed:** `declaration: true`, `declarationMap: true`, `rootDir`, `outDir`, `strict`, `verbatimModuleSyntax`, `isolatedModules` are all compatible with nodenext. The `target: "ES2022"` stays as-is (target and module are independent).

### package.json Field Order

Recommended field order (Claude's discretion):

```json
{
  "name": "agent-dns-firewall",
  "version": "1.0.0",
  "description": "...",
  "type": "module",
  "exports": { ... },
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "sideEffects": false,
  "engines": { "node": ">=18" },
  "scripts": { ... },
  "keywords": [...],
  "author": "johnzilla",
  "license": "MIT",
  "repository": { ... },
  "homepage": "...",
  "bugs": { ... },
  "devDependencies": { ... }
}
```

**Note on top-level `types`:** Even though `exports` has `types` condition, adding a top-level `types` field provides fallback for older TypeScript versions (< 4.7) that don't understand conditional exports. It's harmless and adds compatibility.

### Anti-Patterns to Avoid
- **Using `.npmignore` instead of `files` whitelist:** The whitelist approach (`files: ["dist"]`) is explicitly safer than a denylist (`.npmignore`). This is already a locked decision.
- **Adding `main` field:** The user explicitly decided no `main` field. Node 18+ resolves via `exports`.
- **Bundling output:** The user explicitly decided against bundling. Individual modules allow tree-shaking.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Package validation | Manual checking of tarball contents | `publint` | Checks dozens of packaging rules automatically |
| Type resolution testing | Manual `tsc --noEmit` in a test consumer project | `attw --pack` | Tests all moduleResolution modes (node10, node16, nodenext, bundler) automatically |
| Clean build | Manual `rm -rf dist` | Script: `rm -rf dist && tsc` | Already decided; prevents stale files from previous builds leaking into package |

## Common Pitfalls

### Pitfall 1: Stale dist/ files in tarball
**What goes wrong:** Old compiled files remain in dist/ from a previous build, getting included in the npm package even though source was deleted.
**Why it happens:** `tsc` only compiles -- it doesn't delete removed files.
**How to avoid:** Build script already addresses this: `rm -rf dist && tsc`.
**Warning signs:** `npm pack --dry-run` shows files you don't expect.

### Pitfall 2: esModuleInterop override with nodenext
**What goes wrong:** TypeScript errors or unexpected behavior when `esModuleInterop: false` is set explicitly while `module: "nodenext"` expects `true`.
**Why it happens:** nodenext changes the default for esModuleInterop to true. Explicitly setting false overrides this.
**How to avoid:** Remove the explicit `esModuleInterop: false` line from tsconfig.json.
**Warning signs:** TypeScript compile errors on default imports from CJS packages (not applicable here since zero deps, but good hygiene).

### Pitfall 3: Missing `types` condition in exports
**What goes wrong:** attw reports errors. TypeScript consumers using `moduleResolution: "nodenext"` can't resolve types.
**Why it happens:** Forgetting to add `types` condition, or putting it after `import`.
**How to avoid:** `types` MUST be the first condition in each export entry. Already locked in decision.
**Warning signs:** `attw --pack` will catch this immediately.

### Pitfall 4: Test breakage after tsconfig changes
**What goes wrong:** Vitest tests fail after switching module/moduleResolution.
**Why it happens:** Vitest uses its own module resolution (via Vite/esbuild) which is separate from tsc, but vitest.config.ts itself might be affected.
**How to avoid:** Run `npm test` after tsconfig changes to verify. The current vitest.config.ts uses `import { defineConfig } from 'vitest/config'` without `.js` extension, which is fine because Vitest handles its own resolution.
**Warning signs:** Import resolution errors in test output.

### Pitfall 5: prepublishOnly running on `npm install`
**What goes wrong:** In older npm versions, `prepublishOnly` could run during `npm install`.
**Why it happens:** Legacy npm behavior.
**How to avoid:** npm v7+ only runs `prepublishOnly` before `npm publish`. Since `engines: ">=18"` implies npm v8+, this is not an issue. Just be aware.
**Warning signs:** Build running unexpectedly during install.

## Code Examples

### Complete package.json (target state)
```json
{
  "name": "agent-dns-firewall",
  "version": "1.0.0",
  "description": "Before your agent calls fetch(), ask isDomainBlocked(hostname) and drop known-bad destinations",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "sideEffects": false,
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "build": "rm -rf dist && tsc",
    "check": "npm run build && publint && attw --pack",
    "prepublishOnly": "npm run check",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": [
    "dns", "firewall", "blocklist", "security",
    "ai-agent", "agent", "domain-blocking",
    "allowlist", "denylist"
  ],
  "author": "johnzilla",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/johnzilla/agent-dns-firewall.git"
  },
  "homepage": "https://github.com/johnzilla/agent-dns-firewall#readme",
  "bugs": {
    "url": "https://github.com/johnzilla/agent-dns-firewall/issues"
  },
  "devDependencies": {
    "@arethetypeswrong/cli": "^0.18.2",
    "@vitest/coverage-v8": "^4.0.18",
    "publint": "^0.3.18",
    "typescript": "^5.9.3",
    "vitest": "^4.0.18"
  }
}
```

### Complete tsconfig.json (target state)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

Changes from current: removed `sourceMap: true`, removed `esModuleInterop: false`, changed `module` and `moduleResolution` to `nodenext`.

### Validation commands
```bash
# Build and validate (the check script)
npm run check

# Individual validation steps
npm run build          # rm -rf dist && tsc
npx publint            # validates package structure
npx attw --pack        # validates type resolution

# Verify tarball contents
npm pack --dry-run     # should show only dist/, LICENSE, README.md, package.json

# Test publish (without actually publishing)
npm publish --dry-run  # triggers prepublishOnly -> check
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `main` + `types` fields | `exports` with conditions | Node 12.7+ (2019), mainstream 2023+ | Proper conditional resolution |
| `moduleResolution: "node"` | `moduleResolution: "nodenext"` | TypeScript 4.7+ (2022) | Strict ESM/CJS boundary checking |
| `moduleResolution: "bundler"` | `moduleResolution: "nodenext"` for libraries | TypeScript 5.0+ (2023), consensus 2024+ | Libraries should use nodenext; bundler is for apps |
| Manual type checking | publint + attw | 2023+ | Automated validation catches issues before publish |

**Key insight:** `moduleResolution: "bundler"` is appropriate for applications, but `nodenext` is the standard for libraries. Libraries must work for all consumers, including those using `nodenext`, and `nodenext` is the strictest mode. If it passes under `nodenext`, it works everywhere.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PKG-01 | Conditional exports resolve types | smoke | `npm run build && attw --pack` | N/A (tool validation) |
| PKG-02 | Package metadata fields present | smoke | `npm pack --dry-run` + manual inspection | N/A (config validation) |
| PKG-03 | Version is 1.0.0 | manual-only | Check package.json | N/A |
| PKG-04 | sideEffects: false present | manual-only | Check package.json | N/A |
| PKG-05 | LICENSE exists | manual-only | `test -f LICENSE` | N/A (already exists) |
| BUILD-01 | nodenext module resolution | smoke | `npm run build` (tsc succeeds with nodenext) | N/A |
| BUILD-02 | prepublishOnly runs build+validation | smoke | `npm publish --dry-run` | N/A |
| VAL-01 | publint validates structure | smoke | `npx publint` | N/A (tool validation) |
| VAL-02 | attw validates types | smoke | `npx attw --pack` | N/A (tool validation) |

### Sampling Rate
- **Per task commit:** `npm test && npm run check`
- **Per wave merge:** `npm test && npm run check && npm pack --dry-run`
- **Phase gate:** Full suite green + `npm publish --dry-run` succeeds

### Wave 0 Gaps
- [ ] Install publint and @arethetypeswrong/cli as devDependencies
- [ ] `check` script must be added to package.json before validation commands work

*(No test file gaps -- this phase is validated by tooling, not unit tests)*

## Open Questions

1. **publint/attw version freshness**
   - What we know: publint 0.3.18, attw 0.18.2 are latest as of research date
   - What's unclear: Exact latest at install time may differ
   - Recommendation: Use `^` semver ranges as shown; npm install will get latest compatible

2. **Vitest compatibility with nodenext tsconfig**
   - What we know: Vitest uses Vite/esbuild for module resolution, not tsc. The vitest.config.ts itself doesn't use `.js` extensions but Vite handles that.
   - What's unclear: Whether any edge case in test files surfaces
   - Recommendation: Run `npm test` immediately after tsconfig changes to catch any issues early

## Sources

### Primary (HIGH confidence)
- [Node.js Packages documentation](https://nodejs.org/api/packages.html) - exports field, conditional exports
- [TypeScript Modules Reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html) - nodenext behavior
- [TypeScript TSConfig Reference](https://www.typescriptlang.org/tsconfig/) - esModuleInterop defaults
- Current project source code - all imports verified to use `.js` extensions

### Secondary (MEDIUM confidence)
- [publint npm page](https://www.npmjs.com/package/publint) - v0.3.18 latest
- [@arethetypeswrong/cli npm page](https://www.npmjs.com/package/@arethetypeswrong/cli) - v0.18.2 latest
- [attw CLI README](https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/packages/cli/README.md) - --pack usage
- [TypeScript esModuleInterop defaults with nodenext](https://github.com/microsoft/TypeScript-Website/issues/2587) - confirms default changes

### Tertiary (LOW confidence)
None -- all findings verified with primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - publint and attw are well-established, versions verified on npm
- Architecture: HIGH - conditional exports pattern is well-documented by Node.js and TypeScript; all source code verified for nodenext compatibility
- Pitfalls: HIGH - esModuleInterop interaction verified via TypeScript docs; all imports checked for .js extensions

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain; npm packaging conventions change slowly)
