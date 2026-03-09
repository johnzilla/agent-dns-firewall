# Roadmap: agent-dns-firewall

## Milestones

- ✅ **v1.0** -- Phases 1-3 (shipped 2026-03-09)
- [ ] **v1.1 Publish to npm** -- Phases 4-5 (in progress)

## Phases

<details>
<summary>v1.0 (Phases 1-3) -- SHIPPED 2026-03-09</summary>

- [x] Phase 1: Core Logic (2/2 plans) -- completed 2026-03-09
- [x] Phase 2: Lifecycle and Configuration (2/2 plans) -- completed 2026-03-09
- [x] Phase 3: Quality and Ship (2/2 plans) -- completed 2026-03-09

</details>

### v1.1 Publish to npm

- [x] **Phase 4: Package Configuration** - Package metadata, tsconfig fix, validation tooling, and build script so the library produces a correct npm-publishable artifact (completed 2026-03-09)
- [ ] **Phase 5: CI/CD Pipeline** - GitHub Actions workflows for automated testing across Node versions and build validation on every push/PR

## Phase Details

### Phase 4: Package Configuration
**Goal**: The library produces a correctly shaped npm package that passes automated validation and resolves types for all consumer moduleResolution modes
**Depends on**: Phase 3 (v1.0 complete)
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04, PKG-05, BUILD-01, BUILD-02, VAL-01, VAL-02
**Success Criteria** (what must be TRUE):
  1. `npm pack --dry-run` shows only dist/ files, LICENSE, package.json, and README -- no src/, tests/, or config files leak into the tarball
  2. A consumer project using `moduleResolution: "nodenext"` can import the package and TypeScript resolves all types without errors
  3. `npx publint` and `npx attw --pack` both pass with no errors
  4. Running `npm publish --dry-run` triggers the prepublishOnly script which builds and validates before proceeding
**Plans:** 1/1 plans complete
Plans:
- [ ] 04-01-PLAN.md -- Configure package.json, tsconfig.json, install validation tooling, and verify full check pipeline

### Phase 5: CI/CD Pipeline
**Goal**: Every push and PR is automatically tested across Node 18/20/22 and validated for package correctness
**Depends on**: Phase 4
**Requirements**: CI-01, CI-02, CI-03
**Success Criteria** (what must be TRUE):
  1. Pushing a commit to any branch triggers a CI workflow that runs tests and reports pass/fail status
  2. CI test matrix covers Node 18, 20, and 22 -- a failure on any version is surfaced
  3. CI runs build, publint, and attw validation after tests pass -- a packaging regression fails the workflow
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 4 -> 5

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Logic | v1.0 | 2/2 | Complete | 2026-03-09 |
| 2. Lifecycle and Configuration | v1.0 | 2/2 | Complete | 2026-03-09 |
| 3. Quality and Ship | v1.0 | 2/2 | Complete | 2026-03-09 |
| 4. Package Configuration | 1/1 | Complete    | 2026-03-09 | - |
| 5. CI/CD Pipeline | v1.1 | 0/? | Not started | - |
