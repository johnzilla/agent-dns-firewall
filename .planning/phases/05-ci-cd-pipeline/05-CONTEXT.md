# Phase 5: CI/CD Pipeline - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

GitHub Actions workflow for automated testing across Node 18/20/22 and build validation on every push/PR. No publish automation — that's deferred to v2 (PUB-01).

</domain>

<decisions>
## Implementation Decisions

### Workflow triggers
- Trigger on push to all branches + pull_request events
- Use `paths-ignore` to skip CI for `.md` files, `.planning/`, `docs/`
- Use concurrency group to cancel in-progress runs when new commits are pushed to the same branch

### Workflow structure
- Single workflow file: `.github/workflows/ci.yml`
- Workflow name: "CI"
- Two jobs: `test` (matrix) and `validate` (depends on test)
- Test job: strategy matrix with Node 18, 20, 22
- Validate job: runs on Node 22 only (latest LTS), `needs: [test]`
- `fail-fast: false` in test matrix — show per-version results even if one fails

### Runner & caching
- Runner: `ubuntu-latest` for all jobs
- Caching: `setup-node` with `cache: 'npm'` (uses package-lock.json as key)
- Install command: `npm ci` (deterministic, from lockfile)

### Status reporting
- Add CI status badge to README
- Include branch protection setup instructions in README
- No branch protection configuration in this phase (manual GitHub settings)

### Claude's Discretion
- Exact `paths-ignore` patterns
- Badge placement in README
- Concurrency group naming
- Whether to add `permissions` field to workflow

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `npm run check` script already chains: `rm -rf dist && tsc && publint && attw --pack --profile esm-only`
- `npm test` runs vitest
- package-lock.json exists for `npm ci`

### Established Patterns
- ESM-only, zero runtime dependencies
- Vitest test runner
- publint + attw for package validation (Phase 4)

### Integration Points
- Validate job can reuse `npm run check` script directly
- Test job runs `npm test`
- README badge needs workflow name ("CI") and repo path (johnzilla/agent-dns-firewall)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-ci-cd-pipeline*
*Context gathered: 2026-03-09*
