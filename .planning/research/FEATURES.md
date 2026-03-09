# Feature Research

**Domain:** npm package publishing (ESM-only TypeScript library)
**Researched:** 2026-03-08
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features consumers and the npm ecosystem assume exist. Missing these = package feels unfinished or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `"exports"` map with `types` condition | Modern Node.js resolution (16+) uses exports over main; `types` condition required for TypeScript consumers using `moduleResolution: "node16"` or `"nodenext"` | LOW | Current exports lacks types condition; must become `{ ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } }` |
| `"types"` top-level field | Fallback for older TypeScript tooling and editors that don't read exports conditions | LOW | Currently missing; set to `"./dist/index.d.ts"` |
| `"files"` whitelist | Controls what ships to npm; prevents publishing tests, coverage, .planning, source; safer than .npmignore because it is an allowlist | LOW | Set to `["dist", "LICENSE", "README.md"]` |
| `"engines"` field | Tells consumers minimum Node.js version; npm warns on mismatch during install | LOW | Set `{ "node": ">=18" }` per project constraint |
| `"keywords"` array | npm search discoverability; without keywords the package is invisible on npmjs.com search | LOW | Add domain-relevant terms: `dns`, `firewall`, `blocklist`, `agent`, `security`, `ai-agent` |
| `"repository"` field | Links npm listing to GitHub; enables "Repository" link on npmjs.com page | LOW | Add `{ "type": "git", "url": "https://github.com/..." }` |
| `"homepage"` field | Links npm listing to project homepage/README | LOW | Set to GitHub repo URL |
| `"bugs"` field | Links npm listing to issue tracker | LOW | Set to `{ "url": "https://github.com/.../issues" }` |
| `"author"` field | Attribution on npm listing | LOW | Add author name/email |
| LICENSE file included in package | Legal requirement for MIT license; npm includes it automatically when listed in files | LOW | Already exists in project root |
| Type declarations in published output | TypeScript consumers expect `.d.ts` files alongside `.js`; without them the package is unusable in TS projects | LOW | Already configured: tsconfig has `declaration: true` and `declarationMap: true` |
| `"description"` field | npm listing summary | LOW | Already present; may refine wording |
| Version set to `1.0.0` | Signals production readiness; `0.x` signals instability per semver; library already has 120 tests and complete API | LOW | Currently `0.1.0`; bump to `1.0.0` for publish |
| GitHub Actions CI pipeline | Tests run on every push/PR; standard for any published npm package; consumers check CI status before depending on a library | MEDIUM | Need workflow file with test + build + validate steps |

### Differentiators (Competitive Advantage)

Features that signal a well-maintained, professional package. Not required, but valued by discerning consumers.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Pre-publish validation with `publint` | Catches exports/types misconfigurations before they reach consumers; professional packages run this in CI | LOW | Add as devDep; run in `prepublishOnly` or CI script |
| Pre-publish validation with `@arethetypeswrong/cli` | Catches TypeScript type resolution issues across different moduleResolution settings (node16, bundler, etc.) | LOW | Add as devDep; run in CI; complements publint by focusing on type resolution specifically |
| npm provenance via OIDC trusted publishing | Cryptographic proof the package was built by your CI, not a compromised token; shows "Provenance" badge on npmjs.com | MEDIUM | Requires GitHub Actions workflow with `id-token: write` permission; npm classic tokens were deprecated Dec 2025, so OIDC is now the standard path |
| Automated publish on git tag | Publish triggered by pushing a version tag, no manual `npm publish`; reduces human error and supply chain risk | MEDIUM | Standard workflow: test, build, validate, publish on tag push |
| `prepublishOnly` script | Runs build + validation before publish; prevents publishing stale dist or broken packages during manual publish | LOW | Script: `"prepublishOnly": "npm run build && npx publint"` |
| Source maps in published package | Enables consumers to debug into library source when things go wrong | LOW | Already configured: tsconfig has `sourceMap: true`; included automatically via `dist` in files |
| Declaration maps in published package | Enables "Go to Definition" in editors to jump to `.ts` source rather than `.d.ts` stubs | LOW | Already configured: tsconfig has `declarationMap: true` |
| `"sideEffects": false` field | Tells bundlers (webpack, rollup, esbuild) the package is safe to tree-shake; important for consumers who bundle their agent code | LOW | This library is pure functions with no global side effects |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this specific project.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| CJS build (dual package) | "Support legacy consumers" | Dual-package hazard (two copies loaded simultaneously causes subtle bugs); complex build config with .mjs/.cjs extensions; project already decided ESM-only; Node 18+ has full ESM support | Stay ESM-only; CJS consumers can use dynamic `import()` |
| `.npmignore` file | "Exclude files from publish" | Denylist approach is error-prone: easy to accidentally publish sensitive files (.env, .planning); overrides .gitignore behavior unexpectedly; `files` field is strictly safer as an allowlist | Use `"files"` whitelist in package.json |
| Publishing source `.ts` files | "Let consumers compile themselves" | Consumers expect ready-to-use JS; shipping .ts causes confusion about what to import; increases package size; leaks build config | Ship compiled JS + declarations + source maps + declaration maps |
| Bundling into single file | "Smaller package" | Library is already small (~9 source files); bundling removes tree-shaking ability for consumers; hides internal module boundaries | Ship individual compiled modules; let consumer bundlers tree-shake |
| `semantic-release` or `changesets` | "Automated versioning and changelogs" | Overkill for a single-maintainer library at v1.0; adds significant config complexity and multiple dependencies; manual version bumps are reliable at this scale | Manual `npm version patch/minor/major` + git tag; adopt automation later if release cadence warrants it |
| `postinstall` scripts | "Run setup after install" | Consumers and security scanners distrust packages with postinstall scripts; this library needs zero post-install setup | No lifecycle scripts that run on consumer install |
| `main` field as primary resolution | "Backward compatibility with old Node" | `main` is legacy; `exports` is the standard since Node 12.7+; our minimum Node 18 fully supports exports; having `main` without `exports` causes issues | Use `exports` as primary entry; optionally keep `main` as fallback for very old tooling but it is not necessary |

## Feature Dependencies

```
[exports map with types condition]
    └──requires──> [Type declarations built] (tsconfig declaration: true)
                       └──requires──> [Build step] (tsc)

[files whitelist]
    └──requires──> [Build step] (dist/ must exist before publish)

[publint validation]
    └──requires──> [exports map configured correctly]
    └──requires──> [Build step completed]

[attw validation]
    └──requires──> [exports map with types condition]
    └──requires──> [Build step completed]

[GitHub Actions publish]
    └──requires──> [npm OIDC trusted publisher configured on npmjs.com]
    └──requires──> [All package.json metadata complete]
    └──requires──> [Build + test + validate pipeline]

[prepublishOnly script]
    └──requires──> [Build script works]
    └──enhances──> [Manual npm publish safety]

[npm provenance badge]
    └──requires──> [GitHub Actions publish with OIDC]
    └──requires──> [First successful publish]
```

### Dependency Notes

- **publint/attw require build**: Both tools validate the built output against package.json declarations, so `dist/` must exist first.
- **GitHub Actions publish requires OIDC config**: npm deprecated classic tokens Dec 2025; trusted publishing via OIDC is the current standard for CI/CD publishing.
- **exports types condition requires declaration output**: The `"types"` condition in exports points to `.d.ts` files generated by `tsc`.
- **prepublishOnly enhances manual publish**: Safety net when running `npm publish` locally, ensuring build and validation happen first.
- **Package metadata before CI**: The CI workflow validates the package, so metadata must be correct before the workflow can pass.

## MVP Definition

### Launch With (v1.0 publish)

Minimum needed to publish a professional, installable npm package.

- [ ] Complete package.json metadata -- exports with types condition, types field, files, engines, keywords, repository, author, bugs, homepage, sideEffects
- [ ] Version set to `1.0.0`
- [ ] `files` whitelist: `["dist", "LICENSE", "README.md"]`
- [ ] `prepublishOnly` script that runs build + publint
- [ ] `publint` passing as devDep
- [ ] `@arethetypeswrong/cli` passing as devDep
- [ ] GitHub Actions CI workflow: test + build + validate on push/PR
- [ ] GitHub Actions publish workflow: publish to npm on version tag with OIDC
- [ ] npm OIDC trusted publishing configured (no long-lived tokens)

### Add After Validation (v1.x)

Features to add once the package is live and has consumers.

- [ ] Verify npm provenance badge displays on npmjs.com after first publish
- [ ] CHANGELOG.md -- becomes useful once there are multiple releases to track
- [ ] `npm pack --dry-run` step in CI -- verify package contents match expectations

### Future Consideration (v2+)

Features to defer until the package has meaningful adoption.

- [ ] Automated release tooling (semantic-release/changesets) -- only if release cadence justifies the config overhead
- [ ] Multiple entry points in exports -- only if API surface grows beyond single entry
- [ ] Subpath exports for advanced consumers -- only if specific tree-shaking demands arise

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| package.json metadata (exports, types, files, engines, keywords, repo, etc.) | HIGH | LOW | P1 |
| Version bump to 1.0.0 | HIGH | LOW | P1 |
| `files` whitelist | HIGH | LOW | P1 |
| `sideEffects: false` | MEDIUM | LOW | P1 |
| `prepublishOnly` build script | HIGH | LOW | P1 |
| `publint` validation | HIGH | LOW | P1 |
| `@arethetypeswrong/cli` validation | HIGH | LOW | P1 |
| GitHub Actions CI workflow (test + build + validate) | HIGH | MEDIUM | P1 |
| GitHub Actions publish workflow (tag-triggered + OIDC) | HIGH | MEDIUM | P1 |
| Source maps + declaration maps shipped | MEDIUM | LOW | P1 |
| CHANGELOG.md | LOW | LOW | P3 |
| Automated versioning tooling | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for publish milestone
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## What Exists vs What Needs Adding

### Already in place (from v1.0)

- `"type": "module"` -- ESM configured
- `"exports": { ".": "./dist/index.js" }` -- basic exports present (needs types condition added)
- `"license": "MIT"` -- license field set
- `"description"` -- present and relevant
- LICENSE file -- exists at project root
- tsconfig with `declaration: true`, `declarationMap: true`, `sourceMap: true` -- type and map output configured
- Build script `"build": "tsc"` -- works
- 120 tests passing via Vitest

### Must add for publish

| Item | Category | Depends On |
|------|----------|------------|
| `types` condition in exports map | package.json | Existing build output |
| Top-level `"types"` field | package.json | Existing build output |
| `"files": ["dist", "LICENSE", "README.md"]` | package.json | None |
| `"engines": { "node": ">=18" }` | package.json | None |
| `"keywords"` array | package.json | None |
| `"repository"` field | package.json | None |
| `"homepage"` field | package.json | None |
| `"bugs"` field | package.json | None |
| `"author"` field | package.json | None |
| `"sideEffects": false` | package.json | None |
| Version `1.0.0` | package.json | All other metadata complete |
| `prepublishOnly` script | package.json | publint installed |
| `publint` devDependency | npm install | None |
| `@arethetypeswrong/cli` devDependency | npm install | None |
| GitHub Actions CI workflow | `.github/workflows/` | None |
| GitHub Actions publish workflow | `.github/workflows/` | OIDC config on npmjs.com |
| npm OIDC trusted publisher | npmjs.com config | GitHub repo exists |

## Sources

- [npm package.json documentation](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)
- [Node.js Packages documentation](https://nodejs.org/api/packages.html)
- [Node.js Publishing a TypeScript package](https://nodejs.org/en/learn/typescript/publishing-a-ts-package)
- [2ality: Publishing ESM-based npm packages with TypeScript (Feb 2025)](https://2ality.com/2025/02/typescript-esm-packages.html)
- [Sindresorhus: Pure ESM package guide](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)
- [npm Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/)
- [npm OIDC trusted publishing GA announcement (July 2025)](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/)
- [publint rules reference](https://publint.dev/rules)
- [Are The Types Wrong CLI](https://github.com/arethetypeswrong/arethetypeswrong.github.io)
- [Guide to package.json exports field](https://hirok.io/posts/package-json-exports)
- [Liran Tal: TypeScript ESM/CJS publishing in 2025](https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing)
- [Phil Nash: Things you need for npm trusted publishing (Jan 2026)](https://philna.sh/blog/2026/01/28/trusted-publishing-npm/)

---
*Feature research for: npm package publishing (ESM-only TypeScript library)*
*Researched: 2026-03-08*
