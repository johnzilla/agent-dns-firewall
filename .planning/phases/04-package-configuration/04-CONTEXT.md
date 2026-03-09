# Phase 4: Package Configuration - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Package metadata, tsconfig fix, validation tooling, and build script so the library produces a correct npm-publishable artifact. Consumers using `moduleResolution: "nodenext"` can import and resolve all types. Validation tools (publint, attw) pass with no errors.

</domain>

<decisions>
## Implementation Decisions

### Exports shape
- Single entrypoint: `"."` maps to `{ types: "./dist/index.d.ts", import: "./dist/index.js" }`
- No subpath exports — everything via `"agent-dns-firewall"`
- No top-level `main` field — `exports` only (Node 18+ target)
- Add `"./package.json": "./package.json"` self-reference export for bundler compatibility

### Package metadata
- `author`: "johnzilla"
- `keywords`: dns, firewall, blocklist, security, ai-agent, agent, domain-blocking, allowlist, denylist
- `repository`, `homepage`, `bugs` all derived from github.com/johnzilla/agent-dns-firewall
- `version`: "1.0.0" (per PKG-03)
- `sideEffects`: false (per PKG-04)
- `engines`: { "node": ">=18" }

### Build & validate scripts
- `build`: `rm -rf dist && tsc` — clean dist/ before compiling
- `check`: `npm run build && publint && attw --pack` — standalone validation script
- `prepublishOnly`: `npm run check` — delegates to check script
- publint and @arethetypeswrong/cli installed as devDependencies (not npx)

### Files whitelist
- `files`: ["dist"] — npm auto-includes LICENSE, README.md, package.json
- Declaration maps (.d.ts.map) included in dist/ for IDE "Go to Source"
- Source maps (.js.map) NOT generated — remove `sourceMap: true` from tsconfig
- Keep `declarationMap: true` in tsconfig

### tsconfig changes
- `module`: "nodenext" (was "ES2022") — per BUILD-01
- `moduleResolution`: "nodenext" (was "bundler") — per BUILD-01
- Remove `sourceMap: true`

### Claude's Discretion
- Exact publint/attw version pins
- Any additional tsconfig adjustments needed for nodenext compatibility
- Order of fields in package.json

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- tsconfig.json: Already has `declaration: true`, `declarationMap: true`, `rootDir: src`, `outDir: dist`
- package.json: Already has `type: "module"`, basic exports, build/test scripts
- LICENSE: Already exists (MIT)

### Established Patterns
- ESM-only, zero runtime dependencies
- tsc for compilation (no bundler)
- Vitest for testing

### Integration Points
- package.json `exports` field needs restructuring from simple string to conditional exports object
- tsconfig `module`/`moduleResolution` changing from ES2022/bundler to nodenext/nodenext
- Build script changing from `tsc` to `rm -rf dist && tsc`
- New devDependencies: publint, @arethetypeswrong/cli

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-package-configuration*
*Context gathered: 2026-03-09*
