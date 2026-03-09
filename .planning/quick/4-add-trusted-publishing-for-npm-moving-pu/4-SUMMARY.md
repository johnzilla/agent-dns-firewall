# Quick Task 4: Add npm publish workflow

## What was done

- Created `.github/workflows/publish.yml` — triggers on GitHub release, runs build checks, publishes to npm with provenance
- Initial manual publish of `agent-dns-firewall@1.0.0` to npm (required before automation)
- Configured `NPM_TOKEN` repository secret on GitHub for authentication
- Used granular access token approach instead of OIDC trusted publishing (npm's trusted publisher UI blocked by 2FA setup issues)

## Files changed

| File | Change |
|------|--------|
| `.github/workflows/publish.yml` | Created — automated npm publish on GitHub release |

## Commits

| Hash | Description |
|------|-------------|
| 23499aa | feat(quick-4): create npm trusted publishing workflow |
| faac871 | fix: use NPM_TOKEN secret instead of OIDC trusted publishing |

## Notes

- OIDC trusted publishing can be revisited later once npm 2FA/passkey setup is resolved
- Package is live: `npm i agent-dns-firewall`
- To publish: create a GitHub release → workflow runs automatically
