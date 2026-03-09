# Stack Research: npm Publishing Infrastructure

**Domain:** npm package publishing for existing ESM TypeScript library
**Researched:** 2026-03-08
**Confidence:** HIGH

## Existing Stack (Do Not Change)

Already validated in v1.0. Not re-researched.

| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | ^5.9.3 | Language, type checking, build via `tsc` |
| Vitest | ^4.0.18 | Test framework |
| Node.js | >=18 | Runtime target |
| ESM-only | -- | Module format, `"type": "module"` |

## What Needs to Change for npm Publishing

### 1. package.json Fields

The current package.json is missing critical fields for npm publishing. Here is what must be added:

```jsonc
{
  "name": "agent-dns-firewall",
  "version": "1.1.0",
  "type": "module",
  "description": "Before your agent calls fetch(), ask isDomainBlocked(hostname) and drop known-bad destinations",
  "license": "MIT",

  // CHANGE: Add "types" condition inside exports -- must come FIRST
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },

  // ADD: Whitelist published files (safer than .npmignore)
  "files": ["dist"],

  // ADD: Required for npm listing, discoverability
  "keywords": [
    "dns", "firewall", "blocklist", "agent", "security",
    "ai-agent", "domain-blocking", "hosts-file"
  ],

  // ADD: Required metadata
  "repository": {
    "type": "git",
    "url": "git+https://github.com/<owner>/agent-dns-firewall.git"
  },
  "bugs": {
    "url": "https://github.com/<owner>/agent-dns-firewall/issues"
  },
  "homepage": "https://github.com/<owner>/agent-dns-firewall#readme",

  // ADD: Declares minimum Node version
  "engines": {
    "node": ">=18.0.0"
  },

  // ADD: Prevent accidental publish without CI
  "publishConfig": {
    "access": "public"
  }
}
```

**Why each field matters:**

| Field | Why |
|-------|-----|
| `exports.".".types` | TypeScript consumers with `moduleResolution: "nodenext"` or `"node16"` will NOT find types without this. The `types` condition must come first in the exports object. |
| `files` | Whitelist approach. Only `dist/` ships to npm. Safer than `.npmignore` because it cannot accidentally leak `src/`, `tests/`, `coverage/`, or config files. `package.json`, `README.md`, and `LICENSE` are always included by npm regardless. |
| `engines` | Documents Node 18+ requirement. `npm install` warns if user's Node is too old. |
| `keywords` | npm search discoverability. No functional impact but important for adoption. |
| `repository`/`bugs`/`homepage` | npm registry links. Shows up on npmjs.com package page. |
| `publishConfig.access` | Unscoped packages default to public, but this makes intent explicit and prevents CI confusion. |

### 2. tsconfig.json Changes

**Current config is almost correct.** Two changes needed:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    // CHANGE: "ES2022" -> "NodeNext"
    "module": "NodeNext",
    // CHANGE: "bundler" -> "NodeNext"
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,        // already set
    "declarationMap": true,     // already set
    "sourceMap": true,          // already set
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

**Why change `moduleResolution` from `bundler` to `NodeNext`:**

- `bundler` moduleResolution allows imports that only work in bundlers (e.g., extensionless relative imports). While this project already uses `.js` extensions everywhere (verified), the emitted `.d.ts` files inherit the moduleResolution mode.
- Consumers using `moduleResolution: "nodenext"` or `"node16"` (which TypeScript recommends for Node.js projects) can hit resolution failures with declaration files produced under `bundler` mode.
- `NodeNext` is the TypeScript team's recommendation for libraries published to npm. It enforces that all imports are Node.js-compatible, which is a superset of bundler-compatible.
- Since all source imports already use `.js` extensions, switching to `NodeNext` requires zero code changes. Verified by inspecting all imports in `src/`.

**Why `module: "NodeNext"` instead of `"ES2022"`:**

- `module` and `moduleResolution` should be paired. `NodeNext` module + `NodeNext` moduleResolution is the correct pairing for ESM libraries targeting Node.js.
- With `"type": "module"` in package.json, `module: "NodeNext"` emits ESM (identical output to `"ES2022"` for this project).

### 3. Build Pipeline

**Keep `tsc` as the build tool. Do NOT add tsup, unbuild, or rollup.**

The v1.0 research recommended tsup but the project correctly chose plain `tsc` instead. For this project, `tsc` is the right choice:

- The library has a single entry point (`src/index.ts`) with 9 source files
- `tsc` already generates `.js`, `.d.ts`, `.d.ts.map`, and `.js.map` output
- No bundling needed -- consumers' bundlers handle tree-shaking
- No code transformation beyond TypeScript -> JavaScript
- Zero additional dev dependencies

**Add a `prepublishOnly` script** to enforce build + test before publish:

```json
{
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "prepublishOnly": "npm run build && npm test"
  }
}
```

### 4. Package Validation Tools

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| publint | ^0.3 | Validates package.json fields, exports, and entry points match actual files | Run before publish. Add as npm script. |
| @arethetypeswrong/cli | ^0.17 | Validates TypeScript types resolve correctly for all moduleResolution modes | Run before publish. Catches the exact `bundler` vs `nodenext` issues. |

**Add as dev dependencies and scripts:**

```json
{
  "devDependencies": {
    "publint": "^0.3",
    "@arethetypeswrong/cli": "^0.17"
  },
  "scripts": {
    "check:publish": "publint && attw --pack ."
  }
}
```

**Why these tools:**
- `publint` catches mismatches between declared exports and actual files on disk. Prevents publishing a broken package.
- `@arethetypeswrong/cli` (`attw`) simulates how different TypeScript configurations resolve your types. If a consumer with `moduleResolution: "node16"` would fail to find types, `attw` tells you before you publish.
- Both are lightweight, fast, and standard in the TypeScript library ecosystem.

### 5. CI/CD: GitHub Actions

**Use npm trusted publishing (OIDC) instead of npm tokens.**

Trusted publishing (GA since July 2025) eliminates the need to store `NPM_TOKEN` secrets. GitHub Actions authenticates directly with npm via OIDC. Provenance attestations are generated automatically.

**Two workflows needed:**

#### CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and PR. Tests across Node versions.

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm run build
      - run: npm test
```

#### Publish Workflow (`.github/workflows/publish.yml`)

Triggered by GitHub release creation. Uses trusted publishing.

```yaml
name: Publish
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # Required for trusted publishing OIDC
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm run check:publish
      - run: npm publish --provenance --access public
```

**Key details:**
- `permissions.id-token: write` is required for OIDC authentication with npm
- `--provenance` generates a verifiable link to the source code and build instructions (shows on npmjs.com)
- Trusted publishing requires npm CLI 11.5.1+. The `setup-node@v4` with `node-version: 22` ships npm 10.x, so you may need to add `npm install -g npm@latest` before publish. Verify at implementation time.
- The trusted publisher must be configured on npmjs.com: go to package settings, add GitHub Actions as a trusted publisher, specify the exact workflow filename (`publish.yml`), repository, and optionally an environment

**Setup steps on npmjs.com:**
1. Create an npmjs.com account (if not already)
2. `npm login` locally to create the package initially OR use `npm publish` from CI on first release
3. Navigate to package settings on npmjs.com
4. Under "Trusted Publisher", add GitHub Actions with repo owner, repo name, and workflow filename

### 6. Version Management

**Use manual versioning. Do NOT add semantic-release or changesets.**

Rationale:
- This is a small library with a single maintainer
- Automated version bumping adds complexity (config files, plugins, commit conventions)
- `npm version patch|minor|major` + git tag + GitHub release is sufficient
- semantic-release is valuable for high-frequency multi-contributor projects; overkill here

**Publish workflow:**
1. Update version: `npm version minor` (creates git tag automatically)
2. Push: `git push && git push --tags`
3. Create GitHub release from the tag
4. CI publishes automatically

## Installation Summary

```bash
# New dev dependencies for publishing validation
npm install -D publint @arethetypeswrong/cli
```

No new runtime dependencies. Zero.

## What NOT to Add

| Technology | Why Not |
|------------|---------|
| tsup / unbuild / rollup | `tsc` already handles everything. Adding a bundler adds a dependency and build complexity for zero benefit in this project. |
| semantic-release | Overkill for a single-maintainer library. Manual `npm version` is fine. |
| changesets | Same as above. Write a CHANGELOG.md manually when needed. |
| np (npm publish helper) | Unnecessary with CI-based publishing. `np` is for manual publishing workflows. |
| .npmignore | Use `"files"` field instead. Whitelist is safer than blacklist. |
| CJS build output | Decided as out-of-scope in PROJECT.md. ESM-only. |
| NPM_TOKEN secret | Use trusted publishing (OIDC) instead. No long-lived secrets. |
| Bundled declaration files | `tsc` emits per-file `.d.ts` which is standard and correct. Bundled declarations (via rollup-plugin-dts or similar) are only needed for complex re-export scenarios. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Build | tsc | tsup | Project already uses tsc, output is correct, no bundling needed |
| Module resolution | NodeNext | bundler | `bundler` can produce .d.ts files incompatible with Node.js consumers |
| Publishing auth | Trusted publishing (OIDC) | NPM_TOKEN secret | OIDC is more secure, no secret rotation, provenance is automatic |
| File inclusion | `files` field | `.npmignore` | Whitelist safer than blacklist; prevents accidental leaks |
| Versioning | Manual `npm version` | semantic-release | Overkill for single-maintainer library |
| Package validation | publint + attw | Manual checking | Automated catches issues humans miss; fast to run |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| TypeScript ^5.9 | `module: "NodeNext"` | Full support since TS 4.7, mature and stable |
| Node 18+ | `"type": "module"` ESM | ESM fully stable in Node 18+ |
| npm CLI 11.5.1+ | Trusted publishing | Required for OIDC. Node 22 ships npm 10.x -- may need explicit upgrade in CI |
| publint ^0.3 | Node 18+ | Lightweight, no compatibility concerns |
| @arethetypeswrong/cli ^0.17 | Node 18+ | Lightweight, no compatibility concerns |

## Sources

- [TypeScript: Choosing Compiler Options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html) -- moduleResolution recommendation for libraries
- [Andrew Branch: Is nodenext right for libraries?](https://blog.andrewbran.ch/is-nodenext-right-for-libraries-that-dont-target-node-js/) -- why NodeNext over bundler for npm packages
- [npm Docs: Trusted publishing](https://docs.npmjs.com/trusted-publishers/) -- OIDC setup
- [npm Docs: Generating provenance statements](https://docs.npmjs.com/generating-provenance-statements/) -- provenance with GitHub Actions
- [Phil Nash: Things you need to do for npm trusted publishing to work](https://philna.sh/blog/2026/01/28/trusted-publishing-npm/) -- practical gotchas
- [GitHub Blog: npm trusted publishing with OIDC is generally available](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/) -- GA announcement
- [npm CLI Wiki: Files & Ignores](https://github.com/npm/cli/wiki/Files-&-Ignores) -- files field vs .npmignore
- [2ality: Publishing ESM-based npm packages with TypeScript](https://2ality.com/2025/02/typescript-esm-packages.html) -- ESM package.json patterns
- [publint rules](https://publint.dev/rules) -- what publint validates
- [Sindre Sorhus: Pure ESM package](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c) -- ESM-only package patterns

---
*Stack research for: agent-dns-firewall v1.1 npm publishing*
*Researched: 2026-03-08*
