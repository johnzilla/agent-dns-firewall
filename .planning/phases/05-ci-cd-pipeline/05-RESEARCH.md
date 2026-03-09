# Phase 5: CI/CD Pipeline - Research

**Researched:** 2026-03-09
**Domain:** GitHub Actions CI for Node.js TypeScript library
**Confidence:** HIGH

## Summary

This phase creates a single GitHub Actions CI workflow that runs tests across Node 18/20/22 and validates package correctness on every push and PR. The implementation is straightforward -- GitHub Actions has mature, well-documented support for Node.js matrix testing with official actions.

The project already has all the build and test scripts needed (`npm test`, `npm run check`). The CI workflow simply orchestrates these existing commands. No new dependencies are required -- only a workflow YAML file and a README badge.

**Primary recommendation:** Create `.github/workflows/ci.yml` with two jobs (test matrix + validate), using `actions/checkout@v4` and `actions/setup-node@v4` for maximum compatibility, and add a status badge to the README.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Trigger on push to all branches + pull_request events
- Use `paths-ignore` to skip CI for `.md` files, `.planning/`, `docs/`
- Use concurrency group to cancel in-progress runs when new commits are pushed to the same branch
- Single workflow file: `.github/workflows/ci.yml`
- Workflow name: "CI"
- Two jobs: `test` (matrix) and `validate` (depends on test)
- Test job: strategy matrix with Node 18, 20, 22
- Validate job: runs on Node 22 only (latest LTS), `needs: [test]`
- `fail-fast: false` in test matrix -- show per-version results even if one fails
- Runner: `ubuntu-latest` for all jobs
- Caching: `setup-node` with `cache: 'npm'` (uses package-lock.json as key)
- Install command: `npm ci` (deterministic, from lockfile)
- Add CI status badge to README
- Include branch protection setup instructions in README
- No branch protection configuration in this phase (manual GitHub settings)

### Claude's Discretion
- Exact `paths-ignore` patterns
- Badge placement in README
- Concurrency group naming
- Whether to add `permissions` field to workflow

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CI-01 | GitHub Actions CI workflow runs tests on push and PR | Workflow triggers with push + pull_request events; concurrency groups for efficiency |
| CI-02 | CI tests across Node 18, 20, and 22 | Matrix strategy with `fail-fast: false`; `setup-node` v4 handles version installation |
| CI-03 | CI runs build and validation (publint + attw) after tests | Validate job with `needs: [test]` dependency; reuses existing `npm run check` script |
</phase_requirements>

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| actions/checkout | v4 | Clone repository | Official GitHub action; v4 is the widely-deployed stable major version |
| actions/setup-node | v4 | Install Node.js + cache npm | Official action; v4 has built-in npm caching via `cache: 'npm'` |

**Note on action versions:** While v6 exists for both `actions/checkout` and `actions/setup-node`, v4 remains the most widely used and documented version across the ecosystem. v4 is stable and fully sufficient for this use case. Using v4 avoids potential edge cases with newer releases (e.g., checkout v6 requires Actions Runner v2.329.0+). The user can upgrade later if needed.

### Supporting

No additional tools or actions required. The project's existing npm scripts handle everything:
- `npm test` -- runs vitest
- `npm run check` -- builds, runs publint, runs attw

## Architecture Patterns

### Workflow Structure

```
.github/
  workflows/
    ci.yml          # Single workflow file
```

### Pattern: Two-Job Pipeline (test + validate)

**What:** Separate test matrix from build validation. Tests run in parallel across Node versions; validation runs once after all tests pass.

**When to use:** When you have version-specific tests but version-independent build validation.

**Why:** Avoids running redundant build validation 3 times (once per Node version). The validate job only needs the latest LTS (Node 22) since publint and attw check package structure, not runtime behavior.

```yaml
# Source: GitHub Actions official docs + starter workflows
name: CI

on:
  push:
    branches-ignore: []
    paths-ignore:
      - '*.md'
      - '.planning/**'
      - 'docs/**'
  pull_request:
    paths-ignore:
      - '*.md'
      - '.planning/**'
      - 'docs/**'

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm test

  validate:
    needs: [test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm run check
```

### Anti-Patterns to Avoid

- **Running build validation in the matrix:** Wastes CI minutes running publint/attw 3 times with identical results. Run it once on Node 22.
- **Using `npm install` instead of `npm ci`:** `npm install` may update package-lock.json, causing non-deterministic installs. Always use `npm ci` in CI.
- **Missing `fail-fast: false`:** Default behavior cancels remaining matrix jobs when one fails, hiding whether the failure is version-specific.
- **Caching `node_modules` directly:** The `setup-node` action caches the npm cache directory, not `node_modules`. This is correct -- `npm ci` always does a clean install from cache.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Node.js installation | Shell script to download/install Node | `actions/setup-node@v4` | Handles version resolution, caching, PATH setup |
| Dependency caching | Manual cache action with hash keys | `setup-node` with `cache: 'npm'` | Automatically uses package-lock.json as cache key |
| Concurrency control | Custom job coordination | `concurrency` workflow key | Built-in, handles queuing and cancellation |

## Common Pitfalls

### Pitfall 1: paths-ignore Not Matching Expected Files
**What goes wrong:** CI still runs on documentation-only changes, or CI skips changes to important config files.
**Why it happens:** Glob patterns in `paths-ignore` have specific matching rules. `*.md` only matches root-level `.md` files, not `docs/guide.md`.
**How to avoid:** Use `'**/*.md'` to match all markdown files at any depth, or use `'*.md'` for root-only. Test with a docs-only commit.
**Warning signs:** CI running on README-only PRs.

### Pitfall 2: Concurrency Group Too Broad
**What goes wrong:** Push to branch A cancels a running workflow for branch B.
**Why it happens:** Concurrency group doesn't include branch reference.
**How to avoid:** Include `github.ref` in the group name: `ci-${{ github.ref }}`. This scopes cancellation to the same branch.
**Warning signs:** Workflows being cancelled unexpectedly on unrelated branches.

### Pitfall 3: Badge URL Using Wrong Workflow Name
**What goes wrong:** Badge shows "no status" or 404.
**Why it happens:** Badge URL must reference the workflow file name, not the display name.
**How to avoid:** Use the file path in the badge URL: `.github/workflows/ci.yml`.

### Pitfall 4: Validate Job Running on Test Failure
**What goes wrong:** Build validation runs even when tests failed.
**Why it happens:** Missing `needs` dependency between jobs.
**How to avoid:** Always set `needs: [test]` on the validate job. This is already in the locked decisions.

## Code Examples

### CI Status Badge (Markdown)

```markdown
[![CI](https://github.com/johnzilla/agent-dns-firewall/actions/workflows/ci.yml/badge.svg)](https://github.com/johnzilla/agent-dns-firewall/actions/workflows/ci.yml)
```

Place this at the top of README.md, right after the `# agent-dns-firewall` heading.

### Branch-Specific Badge (Optional)

```markdown
[![CI](https://github.com/johnzilla/agent-dns-firewall/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/johnzilla/agent-dns-firewall/actions/workflows/ci.yml)
```

### Permissions Field (Recommended)

```yaml
permissions:
  contents: read
```

Adding explicit `permissions` follows the principle of least privilege. This workflow only needs to read the repository contents -- it doesn't write, create releases, or interact with issues/PRs. This is a security best practice recommended by GitHub.

### Branch Protection Instructions (for README)

```markdown
## Branch Protection (Recommended)

To require CI to pass before merging to main:
1. Go to Settings > Branches > Add branch protection rule
2. Branch name pattern: `main`
3. Check "Require status checks to pass before merging"
4. Search and select: `test (18)`, `test (20)`, `test (22)`, `validate`
5. Check "Require branches to be up to date before merging" (optional)
```

## Discretion Recommendations

### paths-ignore Patterns
Recommend:
```yaml
paths-ignore:
  - '**/*.md'
  - '.planning/**'
  - 'docs/**'
  - 'LICENSE'
```
Using `'**/*.md'` catches markdown files at any depth. Including `LICENSE` since it's a text-only file that doesn't affect code.

### Badge Placement
Recommend placing immediately after the `# agent-dns-firewall` heading, before the description paragraph. This is the conventional location in open-source projects.

### Concurrency Group Naming
Recommend `ci-${{ github.ref }}` -- simple, descriptive, includes branch scope.

### Permissions Field
Recommend adding `permissions: contents: read` at the workflow level. It's a one-line security improvement with no downsides.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CI-01 | Workflow triggers on push/PR | manual-only | Verify by pushing a commit after workflow creation | N/A |
| CI-02 | Tests run on Node 18, 20, 22 | manual-only | Verify matrix output in GitHub Actions UI | N/A |
| CI-03 | Build + publint + attw run after tests | manual-only | Verify validate job output in GitHub Actions UI | N/A |

**Note:** CI/CD pipeline requirements are inherently manual-verification. The workflow YAML is declarative configuration, not application code. Validation requires pushing to GitHub and observing the Actions tab. Local validation is limited to YAML syntax checking.

### Sampling Rate
- **Per task commit:** `npm test && npm run check` (local verification that scripts still work)
- **Per wave merge:** Push to GitHub and verify Actions tab
- **Phase gate:** Successful CI run visible in GitHub Actions

### Wave 0 Gaps
None -- no new test infrastructure needed. This phase creates CI config, not application code.

## Open Questions

1. **Node 18 EOL timing**
   - What we know: Node 18 enters end-of-life in April 2025 (already EOL as of research date). Node 22 is current LTS.
   - What's unclear: Whether the project should continue testing Node 18 given it's past EOL.
   - Recommendation: Keep Node 18 in matrix for now since `engines` field says `>=18`. Can drop it in a future update when the minimum engine version is bumped.

## Sources

### Primary (HIGH confidence)
- [GitHub Docs: Building and testing Node.js](https://docs.github.com/actions/guides/building-and-testing-nodejs) - workflow structure, matrix strategy
- [GitHub Docs: Workflow syntax](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions) - concurrency, paths-ignore, permissions
- [GitHub Docs: Adding a workflow status badge](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/monitoring-workflows/adding-a-workflow-status-badge) - badge URL format
- [GitHub Docs: Control concurrency](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs) - concurrency groups
- [actions/checkout releases](https://github.com/actions/checkout/releases) - v4 is stable, v6 latest
- [actions/setup-node releases](https://github.com/actions/setup-node/releases) - v4 is stable, v6 latest

### Secondary (MEDIUM confidence)
- [actions/starter-workflows](https://github.com/actions/starter-workflows/blob/main/ci/node.js.yml) - official starter template (referenced but rate-limited during fetch)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - official GitHub Actions, well-documented
- Architecture: HIGH - standard two-job pattern used by thousands of Node.js projects
- Pitfalls: HIGH - well-known issues documented in GitHub community discussions

**Research date:** 2026-03-09
**Valid until:** 2026-06-09 (90 days -- GitHub Actions is stable infrastructure)
