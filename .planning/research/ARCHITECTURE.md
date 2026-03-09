# Architecture Research

**Domain:** npm publishing infrastructure for existing TypeScript ESM library
**Researched:** 2026-03-08
**Confidence:** HIGH

## System Overview

This architecture covers the CI/CD pipeline and package configuration that integrates with the existing `agent-dns-firewall` library. The library source code and build system (tsc, Vitest) are unchanged. This milestone adds publishing infrastructure around them.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Developer Workflow                           │
│                                                                 │
│  git tag v1.1.0 && git push --tags                              │
│         │                                                       │
└─────────┼───────────────────────────────────────────────────────┘
          │
          v
┌─────────────────────────────────────────────────────────────────┐
│                   GitHub Actions CI/CD                           │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │   CI (test)  │───>│  Build Gate  │───>│  Publish to npm  │   │
│  │  every push  │    │  verify dist │    │  tag push only   │   │
│  └──────────────┘    └──────────────┘    └──────────────────┘   │
│                                                │                │
│                                          OIDC id-token          │
│                                          + provenance           │
└────────────────────────────────────────────────┼────────────────┘
                                                 │
                                                 v
                                    ┌────────────────────────┐
                                    │     npm Registry       │
                                    │  agent-dns-firewall    │
                                    │  + provenance badge    │
                                    └────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| CI workflow | Run tests + type-check on every push/PR | `.github/workflows/ci.yml` |
| Publish workflow | Build, verify, publish on version tag push | `.github/workflows/publish.yml` |
| Package metadata | `files`, `exports`, `types`, `repository` fields | `package.json` modifications |
| npm trusted publisher | OIDC-based auth, no long-lived tokens | npm.js settings + workflow permissions |

## New and Modified Files

This is the critical integration map. The existing codebase is stable; this milestone adds files around it.

### New Files

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | Test + type-check on push and PR |
| `.github/workflows/publish.yml` | Build + publish on version tag push |

### Modified Files

| File | Changes | Why |
|------|---------|-----|
| `package.json` | Add `files`, `types`, `repository`, `keywords`, `author`, `engines`; update `exports` to include types | npm registry metadata and package contents control |
| `tsconfig.json` | No changes needed | Already has `declaration: true` and `declarationMap: true` |

### Unchanged Files

Everything in `src/`, `tests/`, `vitest.config.ts`, `LICENSE`, `README.md` -- the library code and test infrastructure remain untouched.

## Architectural Patterns

### Pattern 1: Separate CI and Publish Workflows

**What:** Two distinct workflow files -- `ci.yml` runs on every push/PR; `publish.yml` runs only on version tag push.

**When to use:** Always, for any npm package with CI.

**Trade-offs:** Slightly more files, but clear separation of concerns. CI runs fast on every push. Publish only triggers intentionally via tag. Prevents accidental publishes.

**ci.yml structure:**
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

**publish.yml structure:**
```yaml
name: Publish
on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write    # Required for OIDC trusted publishing
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm publish --provenance --access public
```

### Pattern 2: OIDC Trusted Publishing (No Tokens)

**What:** npm authenticates the publish via GitHub Actions OIDC tokens instead of stored NPM_TOKEN secrets. npm automatically generates provenance attestations.

**When to use:** Always for new packages in 2026. Classic npm tokens were permanently revoked December 9, 2025. Granular tokens expire in 90 days max. OIDC is the preferred path.

**Trade-offs:** Requires npm CLI 11.5.1+ and Node 22.14.0+. The first publish of a brand-new package cannot use OIDC (the package must exist on npm first). Workaround: do the initial publish manually with `npm publish` from local machine using a short-lived granular token, then configure trusted publishing for all subsequent releases.

**Setup steps:**
1. Publish initial version manually (one-time)
2. Go to npmjs.com package settings, add trusted publisher: `owner/repo`, workflow `publish.yml`, environment (optional)
3. All subsequent publishes use OIDC -- no secrets needed in GitHub repo settings

**Critical requirements:**
- `permissions.id-token: write` in workflow
- `package.json` must have `repository.url` matching the GitHub repo URL exactly
- No `NODE_AUTH_TOKEN` or npm token set in the environment (OIDC detection fails if a token is present)
- Node 22+ for the publish job (npm CLI version requirement)

### Pattern 3: Build Verification Before Publish

**What:** The publish workflow re-runs the full build and test suite before publishing, even though CI already ran on the commit.

**When to use:** Always. The tag may point to a commit that was pushed without CI passing. Belt and suspenders.

**Trade-offs:** Slightly slower publish (adds ~30-60 seconds for this small project). Worth it for safety.

**Verification steps in order:**
```
1. npm ci          -- clean install from lockfile
2. npm run build   -- tsc compiles to dist/
3. npm test        -- vitest runs all 111+ tests
4. npm publish     -- only if all above pass
```

### Pattern 4: Package Contents Control via `files` Field

**What:** Use `package.json` `"files"` array instead of `.npmignore` to whitelist what gets published.

**When to use:** Always for TypeScript packages. Whitelist is safer than blacklist.

**Why:** With `.npmignore`, forgetting to exclude a file means it ships. With `"files"`, forgetting to include a file means it does not ship -- the package may break, but you will catch it immediately. You never accidentally publish `tests/`, `coverage/`, or `.env` files.

**Configuration:**
```json
{
  "files": [
    "dist/"
  ]
}
```

This publishes only `dist/` (which contains `.js`, `.d.ts`, `.d.ts.map`, `.js.map` files). `package.json`, `README.md`, and `LICENSE` are always included by npm automatically.

## Data Flow

### Publish Pipeline Flow

```
Developer tags a commit:
  git tag v1.1.0
  git push --tags
      │
      v
GitHub detects tag push matching 'v*'
      │
      v
publish.yml workflow starts
      │
      ├── actions/checkout@v4 (get source)
      │
      ├── actions/setup-node@v4 (Node 22 + registry URL)
      │
      ├── npm ci (install from lockfile)
      │
      ├── npm run build (tsc --> dist/)
      │     Output: dist/index.js, dist/index.d.ts, etc.
      │
      ├── npm test (vitest run)
      │     Gate: fails here = no publish
      │
      └── npm publish --provenance --access public
            │
            ├── OIDC: GitHub mints id-token
            ├── npm verifies token against trusted publisher config
            ├── npm reads "files" field --> packs only dist/ + package.json + README + LICENSE
            ├── npm generates provenance attestation (Sigstore)
            └── Package published to registry with provenance badge
```

### CI Flow (Every Push/PR)

```
Push to main or PR opened
      │
      v
ci.yml workflow starts
      │
      ├── Matrix: Node 18, 20, 22
      │
      ├── npm ci
      ├── npm run build
      └── npm test
```

### Version Management Flow

```
Developer decides to release:
  1. Update version in package.json (npm version patch/minor/major)
     - npm version creates commit + tag automatically
  2. Push commit and tag: git push && git push --tags
  3. GitHub Actions takes over
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| npm Registry | OIDC trusted publishing | No stored secrets; requires one-time manual first publish |
| GitHub Actions | Workflow files in `.github/workflows/` | Uses `actions/checkout@v4` and `actions/setup-node@v4` |
| Sigstore | Automatic via `--provenance` flag | Provenance attestation for supply chain security |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Source (src/) --> Build (dist/) | `tsc` via `npm run build` | Already configured, no changes needed |
| Build (dist/) --> Package | `files` field in package.json | Only dist/ contents are published |
| Tests --> Publish gate | Exit code from `npm test` | Workflow step fails = publish step skipped |
| package.json `exports` --> Consumer | `"."` entry point | Must reference `./dist/index.js` (already does) |
| package.json `types` --> Consumer | Types entry point | Must add `"types": "./dist/index.d.ts"` |

## package.json Integration

The existing `package.json` needs these additions for npm publishing. Showing only the diff:

```json
{
  "name": "agent-dns-firewall",
  "version": "1.1.0",
  "type": "module",
  "description": "Before your agent calls fetch(), ask isDomainBlocked(hostname) and drop known-bad destinations",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "types": "./dist/index.d.ts",
  "files": [
    "dist/"
  ],
  "engines": {
    "node": ">=18"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/agent-dns-firewall/agent-dns-firewall.git"
  },
  "keywords": [
    "dns",
    "firewall",
    "blocklist",
    "agent",
    "security"
  ]
}
```

**Key changes from current:**
- `exports` upgraded from simple string to conditional exports with `types` condition (for TypeScript consumers)
- `types` top-level field added (for older tooling that does not read conditional exports)
- `files` added (controls what ships to npm)
- `engines` added (documents Node 18+ requirement)
- `repository` added (required for OIDC trusted publishing to work)
- `keywords` added (npm discoverability)
- `version` bumped to `1.1.0` (at publish time)

## Anti-Patterns

### Anti-Pattern 1: Using .npmignore Instead of `files`

**What people do:** Create `.npmignore` to exclude `src/`, `tests/`, `coverage/`, etc.
**Why it is wrong:** Blacklist approach. Easy to forget an entry. New directories (like `.planning/`) silently ship to npm.
**Do this instead:** Use `"files": ["dist/"]` in package.json. Whitelist only what consumers need.

### Anti-Pattern 2: Publishing from Local Machine as Standard Practice

**What people do:** Run `npm publish` from their laptop for every release.
**Why it is wrong:** No reproducibility. No audit trail. Risk of dirty working tree. No provenance attestation.
**Do this instead:** Publish only via CI. Local publish is acceptable only for the initial package creation (OIDC requirement).

### Anti-Pattern 3: Storing Long-Lived NPM_TOKEN in GitHub Secrets

**What people do:** Create a granular access token, store as `NPM_TOKEN` secret, use `NODE_AUTH_TOKEN`.
**Why it is wrong:** Granular tokens expire in 90 days max (as of 2025). Classic tokens were revoked entirely. Token rotation is operational burden.
**Do this instead:** Use OIDC trusted publishing. Zero tokens to manage after initial setup.

### Anti-Pattern 4: Skipping Tests in Publish Workflow

**What people do:** Trust that CI already passed and skip `npm test` in the publish workflow.
**Why it is wrong:** Tags can be pushed to commits that never had CI run. Race conditions between push and CI.
**Do this instead:** Always run the full test suite in the publish workflow before `npm publish`.

### Anti-Pattern 5: Publishing Without `--provenance`

**What people do:** Publish without provenance flag, or use OIDC which auto-generates it but do not verify it appears on npm.
**Why it is wrong:** Consumers cannot verify the package was built from the claimed source. Supply chain trust gap.
**Do this instead:** Always use `--provenance`. Verify the badge appears on npmjs.com after first publish.

## Suggested Build Order

Based on dependencies between new components:

```
Phase 1: Package metadata (package.json changes)
  - Add files, types, exports, repository, engines, keywords
  - Verify with npm pack --dry-run that only dist/ ships
  - No external dependencies; pure configuration

Phase 2: CI workflow (.github/workflows/ci.yml)
  - Test + build on push/PR
  - Matrix across Node 18, 20, 22
  - Must pass before Phase 3 can be verified

Phase 3: Publish workflow (.github/workflows/publish.yml)
  - Tag-triggered publish with OIDC + provenance
  - Depends on Phase 1 (package.json must be correct)
  - Depends on Phase 2 (CI workflow pattern to reference)

Phase 4: First publish + trusted publisher setup
  - Manual first publish with short-lived granular token
  - Configure trusted publisher on npmjs.com
  - Tag a release to verify automated pipeline end-to-end
```

**Rationale:** Package metadata must be correct before any publish attempt. CI workflow establishes the test pattern that publish workflow reuses. Publish workflow depends on correct metadata. First publish is the final verification step.

## Version Strategy

Use `npm version` command for version management:

```bash
npm version patch   # 1.1.0 -> 1.1.1 (bug fixes)
npm version minor   # 1.1.0 -> 1.2.0 (new features)
npm version major   # 1.1.0 -> 2.0.0 (breaking changes)
```

`npm version` automatically:
1. Updates `version` in `package.json`
2. Creates a git commit with message `v1.1.0`
3. Creates a git tag `v1.1.0`

Then `git push && git push --tags` triggers the publish workflow.

This is simpler than changesets or semantic-release for a single-maintainer library with infrequent releases.

## Sources

- [npm Trusted Publishers docs](https://docs.npmjs.com/trusted-publishers/) -- OIDC setup, requirements, limitations. **HIGH confidence.**
- [npm Provenance docs](https://docs.npmjs.com/generating-provenance-statements/) -- provenance flag, Sigstore integration. **HIGH confidence.**
- [npm classic tokens revoked (GitHub Changelog, Dec 2025)](https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/) -- token landscape change. **HIGH confidence.**
- [npm security update: granular token changes (Nov 2025)](https://github.blog/changelog/2025-11-05-npm-security-update-classic-token-creation-disabled-and-granular-token-changes/) -- 90-day max expiry. **HIGH confidence.**
- [npm trusted publishing GA (Jul 2025)](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/) -- OIDC general availability. **HIGH confidence.**
- [Publishing npm with provenance (blog, Jan 2026)](https://blog.revathskumar.com/2026/01/publish-npm-module-with-provenance-statement.html) -- practical walkthrough. **MEDIUM confidence.**
- [Trusted publishing practical tips (Phil Nash, Jan 2026)](https://philna.sh/blog/2026/01/28/trusted-publishing-npm/) -- gotchas and setup details. **MEDIUM confidence.**
- [npm/cli wiki: Files & Ignores](https://github.com/npm/cli/wiki/Files-&-Ignores) -- files field vs .npmignore behavior. **HIGH confidence.**
- [Node.js guide: Publishing a TypeScript package](https://nodejs.org/en/learn/typescript/publishing-a-ts-package) -- official Node.js guidance. **HIGH confidence.**

---
*Architecture research for: npm publishing infrastructure (v1.1 milestone)*
*Researched: 2026-03-08*
