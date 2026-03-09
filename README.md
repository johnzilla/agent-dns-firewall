# agent-dns-firewall

Before your agent calls `fetch()`, ask `isDomainBlocked(hostname)` and drop known-bad destinations -- no infrastructure required.

An in-process domain firewall for AI agents. It downloads public blocklists, builds a fast lookup index, and exposes a single synchronous check. Zero runtime dependencies; works with any HTTP client or framework.

## What This Is / What This Isn't

| What This Is | What This Isn't |
|---|---|
| In-process domain lookup library | Not a DNS server or DNS proxy |
| Blocklist-aware (`hosts` and `domains` formats) | Not an HTTP/HTTPS proxy |
| Zero runtime dependencies | Not a system-level network blocker |
| Works with any HTTP client (fetch, axios, undici) | Not a URL or path filter -- domain-level only |
| Runs in Node.js 18+ (uses native `fetch`) | Not a browser library |

## Quick Start

```bash
npm install agent-dns-firewall
```

```typescript
import { createDomainFirewall, PRESET_STEVENBLACK_UNIFIED } from 'agent-dns-firewall';

const firewall = createDomainFirewall({
  sources: [PRESET_STEVENBLACK_UNIFIED],
});

await firewall.start(); // downloads and indexes blocklists

const decision = firewall.isDomainBlocked('malware-domain.example.com');
if (decision.blocked) {
  console.log(`Blocked: ${decision.reason}`);
}

firewall.stop(); // clears refresh timers and aborts pending fetches
```

## Configuration Reference

### `FirewallConfig`

| Field | Type | Required | Description |
|---|---|---|---|
| `sources` | `BlocklistSource[]` | Yes | Blocklist sources to fetch and index |
| `allow` | `string[]` | No | Domains to always allow (exact match, bypasses blocklists) |
| `deny` | `string[]` | No | Domains to always block (exact match, checked before blocklists) |
| `refreshMinutes` | `number` | No | Re-fetch interval in minutes. Omit to disable auto-refresh |
| `log` | `(level: 'warn' \| 'error', message: string) => void` | No | Custom logger. Defaults to `console.warn` / `console.error` |

### `BlocklistSource`

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier for the source |
| `url` | `string` | URL to fetch the blocklist from |
| `format` | `'hosts' \| 'domains'` | Parse format: `hosts` for `/etc/hosts`-style files, `domains` for plain domain lists |

### Presets

Two built-in presets are provided:

| Preset | ID | Format | Description |
|---|---|---|---|
| `PRESET_STEVENBLACK_UNIFIED` | `stevenblack-unified` | `hosts` | [StevenBlack unified hosts](https://github.com/StevenBlack/hosts) |
| `PRESET_HAGEZI_LIGHT` | `hagezi-light` | `domains` | [Hagezi DNS blocklist (light)](https://github.com/hagezi/dns-blocklists) |

### Advanced Example

```typescript
import {
  createDomainFirewall,
  PRESET_STEVENBLACK_UNIFIED,
  PRESET_HAGEZI_LIGHT,
} from 'agent-dns-firewall';

const firewall = createDomainFirewall({
  sources: [PRESET_STEVENBLACK_UNIFIED, PRESET_HAGEZI_LIGHT],
  allow: ['safe.example.com'],       // always permit, even if on a blocklist
  deny: ['evil.example.com'],        // always block, regardless of blocklists
  refreshMinutes: 60,                // re-fetch blocklists every hour
  log: (level, message) => {
    myLogger[level](message);        // plug in your own logger
  },
});

await firewall.start();
```

## API Reference

### `createDomainFirewall(config: FirewallConfig): DomainFirewall`

Creates a firewall instance. Does not fetch blocklists until `start()` is called.

### `DomainFirewall`

| Method | Signature | Description |
|---|---|---|
| `start()` | `() => Promise<void>` | Fetches all configured blocklist sources and builds the domain index. Schedules auto-refresh if `refreshMinutes` is set. Idempotent -- calling `start()` again resets state and re-fetches. |
| `stop()` | `() => void` | Aborts any in-flight fetches, clears refresh timers, and releases resources. |
| `isDomainBlocked(domain)` | `(domain: string) => BlockDecision` | Synchronous lookup. Checks allow list, then deny list, then blocklists (with subdomain matching). Never throws. |

### `BlockDecision`

Returned by `isDomainBlocked()`:

| Field | Type | Description |
|---|---|---|
| `blocked` | `boolean` | Whether the domain is blocked |
| `reason` | `'custom-deny' \| 'blocklist' \| undefined` | Why it was blocked. `undefined` when `blocked` is `false` |
| `listId` | `string \| undefined` | The `BlocklistSource.id` that matched. Set only when `reason` is `'blocklist'` |

## Efficient Fetching

Blocklist fetches use conditional HTTP headers (`ETag` and `If-Modified-Since`) automatically. On the first fetch the library stores cache validators from the server response. Subsequent refreshes send these headers back -- if the server returns `304 Not Modified`, the cached domains are reused without re-downloading the list. This reduces bandwidth for both your application and blocklist providers.

Each firewall instance maintains its own cache -- multiple instances never share or interfere with each other's cached data. When an instance is stopped, its cache is released automatically.

No configuration is needed; this behavior is built into every `start()` and refresh cycle.

## License

MIT
