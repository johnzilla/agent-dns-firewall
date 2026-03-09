---
phase: quick
plan: 4
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/publish.yml
autonomous: false
requirements: [PUB-01]
must_haves:
  truths:
    - "Pushing a GitHub release triggers automated npm publish"
    - "No NPM_TOKEN secret is needed -- OIDC trusted publishing handles auth"
    - "Package is published with provenance attestation"
  artifacts:
    - path: ".github/workflows/publish.yml"
      provides: "Automated npm publish workflow using OIDC trusted publishing"
  key_links:
    - from: ".github/workflows/publish.yml"
      to: "npm registry"
      via: "OIDC token exchange (id-token: write permission)"
      pattern: "id-token.*write"
---

<objective>
Add a GitHub Actions workflow for npm trusted publishing (OIDC) so that
creating a GitHub release automatically publishes the package to npm with
provenance -- no secret tokens required.

Purpose: Move PUB-01 (deferred from v1.1) forward. Trusted publishing is
the modern, secure approach: GitHub proves identity to npm via OIDC rather
than storing long-lived NPM_TOKEN secrets.

Output: `.github/workflows/publish.yml`
</objective>

<execution_context>
@/home/john/.claude/get-shit-done/workflows/execute-plan.md
@/home/john/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.github/workflows/ci.yml
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create npm trusted publishing workflow</name>
  <files>.github/workflows/publish.yml</files>
  <action>
Create `.github/workflows/publish.yml` with:

**Trigger:** `release` event, types `[published]` only (not draft/prereleased).

**Permissions at workflow level:**
- `contents: read`
- `id-token: write` (required for OIDC token exchange with npm)

**Job: publish**
- `runs-on: ubuntu-latest`
- `environment: npm` (GitHub environment -- user will configure this on npm side)
- Steps:
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` with `node-version: 22`, `cache: 'npm'`, and `registry-url: 'https://registry.npmjs.org'`
  3. `npm ci`
  4. `npm run check` (build + publint + attw validation)
  5. `npm publish --provenance --access public`

**Important details:**
- Do NOT set NODE_AUTH_TOKEN env var -- trusted publishing uses the OIDC token automatically when `id-token: write` is set and the npm package is linked to the repo.
- Use `--provenance` flag to generate SLSA provenance attestation.
- Use `--access public` since this is a non-scoped public package.
- Match existing CI workflow style: actions v4, minimal YAML, same node version for publish as validate job.
  </action>
  <verify>
    <automated>cat .github/workflows/publish.yml && echo "---" && grep -q "id-token: write" .github/workflows/publish.yml && grep -q "provenance" .github/workflows/publish.yml && grep -q "registry-url" .github/workflows/publish.yml && echo "PASS: all required elements present"</automated>
  </verify>
  <done>publish.yml exists with OIDC permissions, provenance flag, release trigger, and npm environment</done>
</task>

<task type="checkpoint:human-verify" gate="informational">
  <name>Task 2: Verify workflow and configure npm trusted publishing</name>
  <files>.github/workflows/publish.yml</files>
  <action>
Present the user with the one-time setup steps required on npm and GitHub sides
before the workflow will function.
  </action>
  <verify>User confirms the workflow file looks correct</verify>
  <done>User has reviewed the workflow and understands the npm/GitHub setup steps</done>
  <what-built>GitHub Actions publish workflow using npm trusted publishing (OIDC). No NPM_TOKEN secret needed.</what-built>
  <how-to-verify>
Before this workflow will function, you need to configure npm trusted publishing:

1. Go to https://www.npmjs.com/package/agent-dns-firewall/access (or create the package first with a manual `npm publish` if it does not exist yet)
2. Under "Publishing access" -> "Trusted publishing", link the GitHub repository:
   - Owner: `johnzilla`
   - Repository: `agent-dns-firewall`
   - Workflow filename: `publish.yml`
   - Environment: `npm`
3. On GitHub, create a repository environment named `npm` at:
   https://github.com/johnzilla/agent-dns-firewall/settings/environments
   - No secrets needed, but you can optionally add required reviewers for release gating.

To test: create a GitHub release (tag matching current package.json version) and verify the publish workflow runs and succeeds.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `publish.yml` has `id-token: write` permission (OIDC requirement)
- `publish.yml` triggers on `release` `published` event only
- `publish.yml` uses `--provenance` flag
- `publish.yml` uses `environment: npm` for trusted publishing linkage
- `publish.yml` runs `npm run check` before publish (build validation)
</verification>

<success_criteria>
Publish workflow file exists and contains all elements needed for npm trusted publishing via OIDC. User has clear instructions for the one-time npm/GitHub setup.
</success_criteria>

<output>
After completion, create `.planning/quick/4-add-trusted-publishing-for-npm-moving-pu/4-SUMMARY.md`
</output>
