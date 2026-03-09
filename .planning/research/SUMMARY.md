# Project Research Summary

**Project:** agent-dns-firewall
**Domain:** npm package publishing for existing TypeScript ESM library
**Researched:** 2026-03-08
**Confidence:** HIGH

## Executive Summary

This milestone wraps an already-complete TypeScript ESM library (v1.0, 120 tests, 9 source files) with npm publishing infrastructure. The library code and build system are unchanged. The work is entirely configuration and CI/CD: updating package.json metadata, fixing tsconfig moduleResolution for consumers, adding GitHub Actions workflows, and setting up OIDC trusted publishing. Experts treat this as a "packaging" milestone -- no application logic, just ensuring the artifact is correctly shaped for the npm ecosystem.

The recommended approach is straightforward: fix package.json exports to include a `types` condition, switch tsconfig from `moduleResolution: "bundler"` to `"nodenext"`, add a `files` whitelist, install publint and @arethetypeswrong/cli for validation, create two GitHub Actions workflows (CI and publish), and configure npm OIDC trusted publishing. The entire stack is plain tsc with zero new runtime dependencies and only two new dev dependencies for validation.

The primary risks are shipping broken type declarations (the current `bundler` moduleResolution silently produces `.d.ts` files incompatible with Node.js consumers) and accidentally publishing source/secrets (no `files` whitelist exists today). Both are preventable with configuration changes in Phase 1 and verification via publint, attw, and `npm pack --dry-run`. A secondary risk is the OIDC trusted publishing first-publish chicken-and-egg: the initial publish must be done manually with a short-lived granular token before OIDC can be configured.

## Key Findings

### Recommended Stack

The existing stack (TypeScript 5.9, Vitest 4.0, Node 18+, ESM-only, tsc build) is unchanged. Two dev dependencies are added for publish validation. No bundler, no semantic-release, no CJS output.

**Core technologies (new for this milestone):**
- **publint ^0.3**: validates package.json exports/types/files match actual build output -- catches misconfigurations before they reach consumers
- **@arethetypeswrong/cli ^0.17**: validates TypeScript type resolution across all moduleResolution modes -- the only tool that catches the bundler-vs-nodenext `.d.ts` issue
- **GitHub Actions (OIDC trusted publishing)**: eliminates long-lived npm tokens entirely; classic tokens were revoked Dec 2025, granular tokens expire in 90 days max

**Critical tsconfig change:** Switch `module` and `moduleResolution` from `"ES2022"`/`"bundler"` to `"NodeNext"`/`"NodeNext"`. All source imports already use `.js` extensions, so zero code changes required.

### Expected Features

**Must have (table stakes):**
- `exports` map with `types` condition (TypeScript consumers with `moduleResolution: "nodenext"` cannot find types without it)
- `files` whitelist (`["dist"]`) to control published contents
- `engines`, `keywords`, `repository`, `homepage`, `bugs`, `author` metadata
- Version bumped to `1.0.0` (signals stability; library is production-ready)
- `prepublishOnly` script (build + test gate before any publish)
- GitHub Actions CI workflow (test matrix across Node 18, 20, 22)
- GitHub Actions publish workflow (tag-triggered, OIDC, provenance)
- `sideEffects: false` (enables tree-shaking for consumers who bundle)

**Should have (differentiators):**
- publint + attw validation in CI (catches broken packages before they ship)
- npm provenance badge (supply chain verification visible on npmjs.com)
- Source maps and declaration maps shipped (better debugging/IDE experience for consumers)

**Defer (v2+):**
- Automated release tooling (semantic-release/changesets) -- overkill for single maintainer
- Multiple entry points / subpath exports -- only if API surface grows
- CHANGELOG.md -- becomes useful after multiple releases

### Architecture Approach

The architecture is a CI/CD pipeline wrapping the existing build. Two workflow files (ci.yml and publish.yml) sit alongside package.json metadata changes. The publish pipeline follows a strict sequence: checkout, install, build, test, validate, publish. OIDC trusted publishing replaces stored secrets. The `files` field ensures only `dist/` ships to npm.

**Major components:**
1. **Package metadata** (package.json) -- exports, types, files, engines, repository fields that control how npm and TypeScript consumers resolve the package
2. **CI workflow** (ci.yml) -- test + build on every push/PR across Node 18/20/22 matrix
3. **Publish workflow** (publish.yml) -- tag-triggered build + test + validate + publish with OIDC and provenance
4. **npm trusted publisher config** -- one-time setup on npmjs.com linking GitHub repo to package

### Critical Pitfalls

1. **`moduleResolution: "bundler"` breaks consumer type resolution** -- switch to `"nodenext"` before publishing; all source imports already use `.js` extensions so no code changes needed
2. **Missing `types` condition in exports map** -- add `"types": "./dist/index.d.ts"` as the FIRST condition in exports; without it, TypeScript consumers using modern resolution cannot find types
3. **No `files` whitelist ships tests/source/secrets** -- current `.gitignore` would EXCLUDE `dist/` and INCLUDE `src/` and `tests/`; add `"files": ["dist"]` immediately
4. **Stale or missing `dist/` at publish time** -- add `prepublishOnly` script; CI must have explicit build step before publish
5. **Pre-release versions tagged as `latest`** -- use `--tag beta` for pre-release publishes; build version detection into CI workflow
6. **`declarationMap` references missing `src/`** -- either include `src/` in `files` or disable `declarationMap`; currently source maps will point to files not in the package

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Package Configuration

**Rationale:** All other phases depend on correct package.json and tsconfig. This is the foundation that must be right before any publish attempt. Every critical pitfall (1-4) is addressed here.
**Delivers:** A correctly configured package that passes publint and attw validation, and produces the right tarball contents.
**Addresses:** All table-stakes features (exports with types, files whitelist, metadata fields, version bump, sideEffects, prepublishOnly script). Install publint and attw as dev dependencies.
**Avoids:** Pitfalls 1 (bundler moduleResolution), 2 (missing types condition), 3 (no files whitelist), 4 (no build before publish).
**Includes:** tsconfig changes (module/moduleResolution to NodeNext), declarationMap decision, `npm pack --dry-run` verification.

### Phase 2: CI/CD Pipeline

**Rationale:** With package configuration correct, the CI/CD pipeline can be built and validated. The publish workflow depends on package.json being complete (especially `repository.url` for OIDC).
**Delivers:** Two GitHub Actions workflows -- ci.yml for test/build on push/PR, publish.yml for tag-triggered publish with OIDC and provenance.
**Addresses:** CI workflow, publish workflow, provenance, pre-release tag detection.
**Avoids:** Pitfalls 5 (token security), 6 (pre-release as latest), 7 (no smoke test).
**Includes:** Smoke test step that installs the tarball in a clean directory and verifies both runtime import and type resolution.

### Phase 3: First Publish and Verification

**Rationale:** OIDC trusted publishing cannot be configured until the package exists on npm. This phase handles the one-time manual bootstrap and end-to-end verification.
**Delivers:** Package live on npmjs.com with provenance badge, OIDC trusted publishing configured for all future releases.
**Addresses:** Initial manual publish, OIDC trusted publisher setup on npmjs.com, verification that provenance badge displays.
**Includes:** Version set to 1.0.0, manual publish with short-lived granular token, configure trusted publisher, tag a second release to verify automated pipeline end-to-end.

### Phase Ordering Rationale

- Package configuration MUST come first because both CI validation and publish depend on correct exports, types, and files fields.
- CI/CD pipeline comes second because it builds on the validated package configuration and provides the automation for Phase 3.
- First publish is last because it requires both configuration and CI/CD to be complete, and the OIDC setup has a chicken-and-egg dependency on the package existing on npm first.
- The three phases have strict sequential dependencies -- no parallelism is possible.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (CI/CD):** npm CLI version requirements for OIDC trusted publishing (needs npm 11.5.1+ but Node 22 ships npm 10.x -- may need explicit `npm install -g npm@latest` step). Also: exact smoke test implementation details and pre-release tag detection logic.
- **Phase 3 (First Publish):** npmjs.com trusted publisher UI setup steps; verify exact workflow filename and environment configuration requirements.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Package Configuration):** Well-documented patterns with official TypeScript and npm documentation. All changes are package.json and tsconfig.json fields with clear specifications.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing stack is proven; new additions (publint, attw) are standard tools with official docs |
| Features | HIGH | npm package.json fields are well-specified; feature list matches official npm and TypeScript publishing guides |
| Architecture | HIGH | CI/CD patterns are standard GitHub Actions; OIDC trusted publishing has official npm documentation |
| Pitfalls | HIGH | All pitfalls sourced from official npm/TypeScript docs and verified community reports; moduleResolution issue confirmed by inspecting current tsconfig |

**Overall confidence:** HIGH

### Gaps to Address

- **npm CLI version for OIDC:** Node 22 ships npm 10.x but trusted publishing requires npm 11.5.1+. Verify at implementation time whether `actions/setup-node@v4` with Node 22 includes a compatible npm version, or if an explicit npm upgrade step is needed.
- **declarationMap decision:** Source maps in `.d.ts.map` files reference `src/` which is not published. Either include `src/` in the `files` array (increases package size) or disable `declarationMap` (loses IDE "go to definition" into source). Decide during Phase 1 implementation.
- **First publish bootstrapping:** The exact flow for initial manual publish with a granular token before OIDC is configured needs validation. Granular tokens have 90-day max expiry -- verify one can be created with sufficient scope for a single package.
- **README content for npm:** The current README may be developer-oriented rather than consumer-oriented. It should lead with `npm install` and quick-start usage for the npmjs.com listing. Evaluate during Phase 1.

## Sources

### Primary (HIGH confidence)
- [TypeScript: Choosing Compiler Options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html)
- [npm Trusted Publishing docs](https://docs.npmjs.com/trusted-publishers/)
- [npm Provenance docs](https://docs.npmjs.com/generating-provenance-statements/)
- [Node.js: Publishing a TypeScript package](https://nodejs.org/en/learn/typescript/publishing-a-ts-package)
- [npm package.json documentation](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)
- [npm CLI wiki: Files & Ignores](https://github.com/npm/cli/wiki/Files-&-Ignores)
- [npm classic tokens revoked (Dec 2025)](https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/)

### Secondary (MEDIUM confidence)
- [Andrew Branch: Is nodenext right for libraries?](https://blog.andrewbran.ch/is-nodenext-right-for-libraries-that-dont-target-node-js/)
- [2ality: Publishing ESM-based npm packages with TypeScript](https://2ality.com/2025/02/typescript-esm-packages.html)
- [Sindresorhus: Pure ESM package guide](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)
- [Phil Nash: npm trusted publishing tips (Jan 2026)](https://philna.sh/blog/2026/01/28/trusted-publishing-npm/)
- [publint rules reference](https://publint.dev/rules)

---
*Research completed: 2026-03-08*
*Ready for roadmap: yes*
