# Pitfalls Research

**Domain:** Publishing a TypeScript ESM-only library to npm
**Researched:** 2026-03-08
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: moduleResolution "bundler" breaks consumer type resolution

**What goes wrong:**
The project currently uses `"moduleResolution": "bundler"` in tsconfig.json. This setting is "infectious" -- it allows code patterns (like extensionless relative imports) that only work when consumers also use a bundler. Consumers using `moduleResolution: "node16"` or `"nodenext"` (the correct settings for Node.js projects) will fail to resolve types from the published package. TypeScript will find the `.d.ts` files but refuse to use them, producing errors like "there are types at this path but this result could not be resolved when respecting package.json exports."

**Why it happens:**
`"bundler"` is convenient during development because it does not require `.js` extensions on relative imports. But published packages must work for ALL consumers, not just bundler users. The TypeScript documentation explicitly states that `"nodenext"` checks that output works in Node.js, and code that works in Node.js will generally work in bundlers too -- but not the reverse.

**How to avoid:**
Switch tsconfig.json to `"module": "nodenext"` and `"moduleResolution": "nodenext"` before publishing. This requires verifying all relative imports in source files use `.js` extensions (e.g., `import { foo } from './bar.js'`). The existing source already uses `.js` extensions in imports (confirmed in `src/index.ts`), so this may be a low-friction change. The existing `"verbatimModuleSyntax": true` setting is already compatible.

**Warning signs:**
- tsconfig.json has `"moduleResolution": "bundler"` (current state)
- No `"types"` condition in package.json exports map
- Consumer projects report "could not find declaration file" despite `.d.ts` files being present in the package

**Phase to address:**
Package configuration phase (first). Must be fixed before any publish attempt.

---

### Pitfall 2: Missing "types" condition in package.json exports map

**What goes wrong:**
The current package.json has `"exports": { ".": "./dist/index.js" }` with no `"types"` condition. When consumers use `moduleResolution: "node16"` or `"nodenext"`, TypeScript resolves types through the `exports` map. Without an explicit `"types"` entry, TypeScript may fail to find type declarations even though the `.d.ts` files exist adjacent to the `.js` files. The `exports` field takes precedence over top-level `"main"` and `"types"` fields.

**Why it happens:**
Many tutorials show only the top-level `"main"` and `"types"` fields, which work with older `moduleResolution: "node"` but are ignored when `exports` is present and consumers use modern resolution.

**How to avoid:**
Add a `"types"` condition to the exports map, and it MUST come first (TypeScript matches the first applicable condition):
```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  }
}
```
Also add top-level `"main"` and `"types"` fields as fallbacks for older tooling:
```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

**Warning signs:**
- `exports` map has plain string values instead of condition objects
- No `"types"` key in the exports conditions
- Consumer projects report "could not find declaration file" errors

**Phase to address:**
Package configuration phase (first).

---

### Pitfall 3: Publishing without a "files" whitelist -- shipping tests, source, and potentially secrets

**What goes wrong:**
Without a `"files"` field in package.json and without a `.npmignore`, npm falls back to `.gitignore` for exclusion rules. The current `.gitignore` excludes `node_modules/`, `dist/`, and `coverage/`. This means `dist/` (the actual build output consumers need) would be EXCLUDED from the published package, while `src/`, `tests/`, `vitest.config.ts`, `tsconfig.json`, and any future `.env` files would all be INCLUDED. The package would ship source and tests but not the compiled output.

**Why it happens:**
`.gitignore` and npm publishing have opposite needs. You gitignore `dist/` (build artifacts you do not commit) but that is exactly what you want to publish. You want `src/` in git but not in the npm package. First-time publishers do not realize `.gitignore` serves as the default npm exclusion list when no `.npmignore` or `"files"` field exists.

**How to avoid:**
Use the `"files"` whitelist in package.json (allowlist approach, safer than `.npmignore` blocklist):
```json
{
  "files": ["dist/"]
}
```
This ensures only `dist/` plus always-included files (package.json, README.md, LICENSE) ships in the tarball. No `.npmignore` needed. The `"files"` approach is the npm-recommended best practice because it is an allowlist -- any new file added to the project is excluded by default unless explicitly added.

Always run `npm pack --dry-run` to verify contents before publishing.

**Warning signs:**
- No `"files"` field in package.json (current state)
- No `.npmignore` file (current state)
- `npm pack --dry-run` shows test files, config files, or source in the tarball
- Package size is unexpectedly large (megabytes instead of kilobytes)

**Phase to address:**
Package configuration phase (first).

---

### Pitfall 4: No build step before publish -- stale or missing dist/

**What goes wrong:**
Running `npm publish` without running `npm run build` first publishes stale or missing `dist/` contents. Since `dist/` is gitignored, a fresh clone (as in CI) has no `dist/` directory at all, resulting in an empty or broken package.

**Why it happens:**
Locally, developers often have a `dist/` directory from previous builds. They test, it works, they publish -- not realizing `dist/` contains stale output. In CI, the problem is worse: `dist/` does not exist unless the workflow explicitly runs a build step.

**How to avoid:**
Add a `"prepublishOnly"` lifecycle script to package.json:
```json
{
  "scripts": {
    "prepublishOnly": "npm run build && npm test"
  }
}
```
This runs build + test automatically before every publish attempt (both local and CI). In the CI workflow, also add an explicit build step -- do not rely solely on lifecycle scripts.

**Warning signs:**
- No `prepublishOnly` script in package.json (current state)
- CI workflow has a publish step but no preceding build step
- `npm pack --dry-run` shows no `.js` files or only stale files in `dist/`

**Phase to address:**
Package configuration phase (prepublishOnly script) and CI/CD pipeline phase (explicit workflow step).

---

### Pitfall 5: npm token with excessive scope and no expiration

**What goes wrong:**
Using a classic npm automation token gives CI/CD full write access to every package on the account. If the token leaks through logs, a compromised dependency, or a supply chain attack on a GitHub Action, an attacker can publish malicious versions of any package you maintain.

**Why it happens:**
Classic tokens are the simplest to set up. Many tutorials still show them. Granular tokens and trusted publishing (OIDC) are newer.

**How to avoid:**
Use npm trusted publishing (OIDC) with GitHub Actions. This eliminates long-lived tokens entirely. The workflow uses short-lived, cryptographically-signed tokens specific to the workflow run that cannot be extracted or reused.

Configuration requires:
1. Link the GitHub repository to the npm package in npm's web UI under "Trusted Publishers"
2. Set `id-token: write` permission in the GitHub Actions workflow
3. Use `provenance: true` in the publish step

If OIDC is not viable, use a granular access token scoped to only the `agent-dns-firewall` package with write permissions and a short expiration (90 days max).

**Warning signs:**
- NPM_TOKEN secret is a classic automation token
- Token has no expiration date
- Token grants access to all packages, not just this one
- No provenance attestation on published versions

**Phase to address:**
CI/CD pipeline phase.

---

### Pitfall 6: Pre-release versions tagged as "latest"

**What goes wrong:**
Running `npm publish` for a version like `1.1.0-beta.1` tags it as `latest` by default. Anyone running `npm install agent-dns-firewall` gets the pre-release. npm does NOT auto-detect pre-release version strings.

**Why it happens:**
npm always applies the `latest` dist-tag unless you explicitly specify a different tag. This is a known, longstanding behavior that catches most first-time publishers.

**How to avoid:**
Always use `--tag` for pre-release publishes:
```bash
npm publish --tag beta    # or --tag next
```
In CI/CD, add logic to detect pre-release versions (presence of `-` in the version string) and automatically apply a non-latest tag. When ready for the stable release, publish without `--tag` so it gets `latest` naturally.

**Warning signs:**
- Version string contains `-` (alpha, beta, rc) but publish command has no `--tag` flag
- `npm info agent-dns-firewall dist-tags` shows a pre-release as `latest`

**Phase to address:**
CI/CD pipeline phase. Build tag detection into the GitHub Actions workflow.

---

### Pitfall 7: Not testing the packaged artifact as a consumer would install it

**What goes wrong:**
The package publishes, types appear to resolve, but when a consumer imports it, runtime errors occur. Common causes: the `exports` map points to a wrong file path, the entry point has a broken transitive import, or a file is missing from the tarball. Unit tests pass because they import from source (`../src/`) and never exercise the packaged artifact.

**Why it happens:**
Testing from the source tree exercises different module resolution paths than installing from a tarball. Import paths, file presence, and `exports` map resolution all differ between development and consumption.

**How to avoid:**
Add a smoke test step that tests the packaged artifact:
```bash
# In CI, after build:
npm pack
mkdir /tmp/smoke && cd /tmp/smoke
npm init -y && echo '{"type":"module"}' > package.json
npm install /path/to/agent-dns-firewall-*.tgz
node -e "import('agent-dns-firewall').then(m => { if (!m.createDomainFirewall) process.exit(1) })"
# Also verify types resolve:
npx tsc --noEmit --moduleResolution nodenext test-types.ts
```

**Warning signs:**
- No integration/smoke test that installs the package from its tarball
- All tests import from `../src/` paths
- CI passes but first user reports "cannot find module"

**Phase to address:**
CI/CD pipeline phase. Add a smoke test job that runs after build but before publish.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip smoke test, rely on unit tests only | Faster CI, simpler setup | Broken packages reach npm, erodes user trust | Never for published packages |
| Use classic npm token instead of OIDC | 5 min faster initial setup | Full account compromise risk if token leaks | Never -- OIDC is a one-time setup cost |
| Keep `moduleResolution: "bundler"` | No import path changes needed | Breaks type resolution for Node.js consumers | Never for published libraries |
| Skip `prepublishOnly` script | Less configuration | Stale or empty builds published accidentally | Never |
| Manual version bumps with no automation | No tooling to learn | Forgotten bumps, duplicate version attempts, tag mismatches | Acceptable for first few releases; automate once cadence is established |
| `declarationMap: true` without shipping `src/` | Better IDE go-to-definition locally | Source maps in `.d.ts.map` reference `src/` files not in the package; consumers get broken "go to definition" that opens empty files | Acceptable if you include `src/` in `"files"`, otherwise disable declarationMap |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| npm registry (first publish) | Forgetting `--access public` on a scoped package; for unscoped packages this is not needed but good to know | If the package is ever scoped (`@scope/name`), first publish requires `--access public` |
| npm registry (provenance) | Publishing without `--provenance` flag -- no supply chain verification for consumers | Use `provenance: true` in GitHub Actions publish step; requires `id-token: write` permission |
| GitHub Actions (token) | Storing NPM_TOKEN as repository secret with classic token, no expiration | Use npm trusted publishing (OIDC) or granular token with expiration and single-package scope |
| GitHub Actions (trigger) | Triggering publish on every push to main | Trigger publish only on GitHub Release creation or version tags (`v*`) |
| GitHub Actions (supply chain) | Using actions with mutable tags (`actions/setup-node@v4`) | Pin actions to full commit SHA for supply chain security |
| GitHub Actions (permissions) | Using default `GITHUB_TOKEN` permissions (too broad) | Set `permissions:` explicitly in workflow, only grant what is needed |
| npm registry (README) | README not present in tarball or shows development instructions instead of install/usage | npm renders README.md as the package page; ensure it leads with `npm install` and quick start |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `.env` or config files included in published package | API keys, credentials exposed to every npm user; irreversibly public within seconds across thousands of registry mirrors | Use `"files"` whitelist in package.json; run `npm pack --dry-run` before every publish |
| npm token printed in CI logs | Token visible in GitHub Actions logs, harvestable by anyone with repo read access | Use OIDC trusted publishing; never `echo` or log token values; npm CLI redacts by default but custom scripts may not |
| No 2FA on npm account | Account takeover leads to malicious package versions pushed to all consumers | Enable 2FA on npm account; use automation/granular tokens for CI that bypass the 2FA prompt |
| Publishing from a developer machine instead of CI | Inconsistent builds, risk of local-only files leaking, no audit trail | Publish exclusively from CI/CD; use npm trusted publishing which only works from designated CI environments |
| `node_modules/` somehow included in tarball | Massive package size, potential transitive credential files exposed | `"files"` whitelist prevents this entirely; `npm pack --dry-run` catches it |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No `"description"`, `"keywords"`, `"repository"` in package.json | Package is hard to find on npm search, no link to source code | Fill in all metadata fields before first publish; `"repository"` enables npm's "GitHub" link |
| No `"engines"` field specifying Node >= 18 | Users on Node 16 install the package, get cryptic ESM errors at runtime | Add `"engines": { "node": ">=18" }` to package.json |
| Missing `"homepage"` field | npm package page has no link to documentation | Set `"homepage"` to the GitHub repo or a docs URL |
| No CHANGELOG between versions | Users cannot determine what changed; must read commit history | Maintain CHANGELOG.md or use GitHub Releases (npm links to them if `"repository"` is set) |
| Version still at 0.1.0 for a stable library | Signals instability; SemVer says 0.x means "anything may change at any time" | The library shipped v1.0 milestone; first npm publish should be `1.0.0` to signal stability |
| `declarationMap` source maps point to missing `src/` | Consumers click "Go to Definition" in their IDE and get an empty file or error | Either include `src/` in `"files"` or set `declarationMap: false` in tsconfig for the publish build |

## "Looks Done But Isn't" Checklist

- [ ] **exports map:** Has `"."` entry but missing `"types"` condition -- verify TypeScript consumers can resolve types with `moduleResolution: "nodenext"`
- [ ] **"files" whitelist:** Field exists but does not include `dist/` -- run `npm pack --dry-run` and confirm `.js` and `.d.ts` files are present, and test/source files are absent
- [ ] **prepublishOnly:** Script runs `build` but not `test` -- ensure both run: `"prepublishOnly": "npm run build && npm test"`
- [ ] **CI workflow ordering:** Build step exists but runs after publish step -- verify correct sequence: checkout, install, build, test, smoke test, publish
- [ ] **Type declarations:** `.d.ts` files exist in `dist/` but `declarationMap` source maps reference `src/` files not in the package -- either ship `src/` or disable `declarationMap`
- [ ] **README:** Has development docs but install command says "clone this repo" instead of `npm install agent-dns-firewall`
- [ ] **Version number:** Still at `0.1.0` -- first npm publish should use a version that signals the library's actual maturity
- [ ] **package.json "type":** Must remain `"module"` for ESM -- verify it is not accidentally removed during metadata edits
- [ ] **LICENSE file:** Must exist in project root (already present) -- `"files"` whitelist does not need to list it; npm always includes it
- [ ] **Provenance:** CI workflow uses `provenance: true` and `id-token: write` -- verify on first publish that npm shows "published with provenance"

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Published with broken types | MEDIUM | Publish a patch version with corrected exports map; cannot unpublish after 72 hours |
| Published with missing dist/ files | MEDIUM | Publish a patch version with correct `"files"` field; old broken version remains on registry forever |
| Published secrets in package | HIGH | Immediately rotate ALL exposed credentials; `npm unpublish` within 72 hours if possible; contact npm support after 72 hours; assume credentials are permanently compromised regardless of unpublish success |
| Pre-release tagged as "latest" | LOW | Run `npm dist-tag add agent-dns-firewall@<stable-version> latest` to redirect latest to the correct stable version |
| Published wrong version number | LOW | Cannot reuse a version number once published; publish the next patch with correct content and deprecate the bad version with `npm deprecate` |
| npm token compromised | HIGH | Revoke token immediately in npm settings; audit recent publishes with `npm info agent-dns-firewall` for unexpected versions; rotate to OIDC trusted publishing |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| moduleResolution "bundler" (Pitfall 1) | Package configuration | `tsc` compiles successfully with `module: "nodenext"`; smoke test confirms type resolution |
| Missing "types" in exports (Pitfall 2) | Package configuration | Consumer test file compiles with `moduleResolution: "nodenext"` |
| No "files" whitelist (Pitfall 3) | Package configuration | `npm pack --dry-run` output shows only dist/, README.md, LICENSE, package.json |
| No build before publish (Pitfall 4) | Package config + CI/CD | `prepublishOnly` script exists; CI workflow has explicit build step before publish |
| npm token security (Pitfall 5) | CI/CD pipeline | OIDC trusted publishing configured; no long-lived secrets stored |
| Pre-release tag issue (Pitfall 6) | CI/CD pipeline | Workflow detects `-` in version string and applies non-latest dist-tag |
| No smoke test (Pitfall 7) | CI/CD pipeline | CI job installs tarball in clean directory, imports package, verifies types resolve |
| Missing package.json metadata | Package configuration | All metadata fields populated: description, keywords, repository, engines, homepage |
| declarationMap broken references | Package configuration | Either `src/` included in files or `declarationMap` disabled |
| Version number decision | Package configuration | Version set to `1.0.0` (or appropriate semver) before first publish |

## Sources

- [npm official blog: Publishing what you mean to publish](https://blog.npmjs.org/post/165769683050/publishing-what-you-mean-to-publish.html) -- files/ignores behavior
- [npm Files & Ignores wiki](https://github.com/npm/cli/wiki/Files-&-Ignores) -- authoritative rules for file inclusion/exclusion
- [TypeScript Publishing documentation](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html) -- official guidance on types in packages
- [Andrew Branch: Is nodenext right for libraries?](https://blog.andrewbran.ch/is-nodenext-right-for-libraries-that-dont-target-node-js/) -- why nodenext over bundler for published libraries
- [2ality: Publishing ESM-based npm packages with TypeScript](https://2ality.com/2025/02/typescript-esm-packages.html) -- comprehensive ESM publishing guide
- [npm Trusted Publishing docs](https://docs.npmjs.com/trusted-publishers/) -- OIDC-based publishing without long-lived tokens
- [Liran Tal: Avoiding secret leaks to npm](https://dev.to/lirantal/how-to-avoid-leaking-secrets-to-the-npm-registry-2jip) -- prevention strategies
- [npm CLI issue #7553: Pre-release tagged as latest](https://github.com/npm/cli/issues/7553) -- longstanding default behavior
- [Snyk: Best practices for modern npm packages](https://snyk.io/blog/best-practices-create-modern-npm-package/) -- security and configuration practices
- [GitHub changelog: npm token security changes](https://github.blog/changelog/2025-09-29-strengthening-npm-security-important-changes-to-authentication-and-token-management/) -- granular token requirements
- [Tim Kadlec on automatic npm publishing with granular tokens](https://httptoolkit.com/blog/automatic-npm-publish-gha/) -- GitHub Actions CI/CD setup

---
*Pitfalls research for: TypeScript ESM npm publishing (v1.1 milestone)*
*Researched: 2026-03-08*
