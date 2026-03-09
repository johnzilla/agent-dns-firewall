---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: [src/index.ts]
autonomous: true
requirements: [API-SURFACE]
must_haves:
  truths:
    - "Only createDomainFirewall, presets, and types are exported from the package entry point"
    - "Internal helpers (normalizeDomain, parseHostsFormat, parseDomainList, buildDomainIndex, isDomainInIndex, sanitizeInput, isDomainBlocked) are NOT exported from index.ts"
    - "All existing tests still pass (they import from individual modules, not index)"
    - "Package builds without errors"
  artifacts:
    - path: "src/index.ts"
      provides: "Public API surface"
      contains: "createDomainFirewall"
  key_links:
    - from: "src/index.ts"
      to: "src/firewall.ts"
      via: "re-export createDomainFirewall"
      pattern: "export.*createDomainFirewall"
---

<objective>
Refine src/index.ts to only export symbols intended for public consumption, removing internal helper functions.

Purpose: Align the package exports with its documented API, providing a cleaner and more stable public surface. Internal helpers remain available within the package but are not part of the public contract.
Output: Updated src/index.ts with only public exports.
</objective>

<execution_context>
@/home/john/.claude/get-shit-done/workflows/execute-plan.md
@/home/john/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/index.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restrict index.ts to public API exports only</name>
  <files>src/index.ts</files>
  <action>
Replace the contents of src/index.ts with only the public API exports:

```typescript
export type { BlockDecision, BlocklistSource, FirewallConfig, DomainFirewall } from './types.js';
export { createDomainFirewall } from './firewall.js';
export { PRESET_STEVENBLACK_UNIFIED, PRESET_HAGEZI_LIGHT } from './presets.js';
```

Remove these lines that currently export internal helpers:
- `export { normalizeDomain } from './normalize.js';`
- `export { parseHostsFormat, parseDomainList } from './parse.js';`
- `export { buildDomainIndex, isDomainInIndex } from './match.js';`
- `export { sanitizeInput, isDomainBlocked } from './decide.js';`

These internal functions remain accessible within the package via direct module imports but are no longer part of the public API surface.
  </action>
  <verify>
    <automated>cd /home/john/vault/projects/github.com/agent-dns-firewall && npm run build && npm test</automated>
  </verify>
  <done>src/index.ts exports only: types (BlockDecision, BlocklistSource, FirewallConfig, DomainFirewall), createDomainFirewall, PRESET_STEVENBLACK_UNIFIED, PRESET_HAGEZI_LIGHT. No internal helpers exported. Build and tests pass.</done>
</task>

</tasks>

<verification>
- `npm run build` succeeds without errors
- `npm test` — all existing tests pass (tests import from individual modules, not index)
- `grep -c 'export' src/index.ts` returns 3 (one type export, two value exports)
</verification>

<success_criteria>
- src/index.ts contains exactly 3 export lines (types, firewall factory, presets)
- No internal helpers (normalizeDomain, parseHostsFormat, parseDomainList, buildDomainIndex, isDomainInIndex, sanitizeInput, isDomainBlocked) are exported from the entry point
- Package builds and all tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/1-refine-the-public-api-surface/1-SUMMARY.md`
</output>
