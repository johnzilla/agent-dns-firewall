import type { FirewallConfig, DomainFirewall, BlockDecision } from './types.js';
import { fetchAllSources } from './fetch.js';
import { isDomainBlocked } from './decide.js';
import { buildDomainIndex } from './match.js';

function defaultLog(level: 'warn' | 'error', message: string): void {
  if (level === 'error') {
    console.error(message);
  } else {
    console.warn(message);
  }
}

export function createDomainFirewall(config: FirewallConfig): DomainFirewall {
  const allowSet = buildDomainIndex(config.allow ?? []);
  const denySet = buildDomainIndex(config.deny ?? []);
  const log = config.log ?? defaultLog;

  let blocklistEntries: Array<{ index: Set<string>; sourceId: string }> = [];
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;

  function scheduleRefresh(): void {
    if (!config.refreshMinutes) return;

    refreshTimer = setTimeout(async () => {
      try {
        const entries = await fetchAllSources(
          config.sources,
          abortController!.signal,
          log,
        );
        // Atomic swap -- only replace if at least one source succeeded
        if (entries.length > 0) {
          blocklistEntries = entries;
        }
      } catch {
        // On failure (e.g., abort), preserve existing entries
      }
      // Chain next refresh (unless stopped)
      if (refreshTimer !== null) {
        scheduleRefresh();
      }
    }, config.refreshMinutes * 60_000);
  }

  async function start(): Promise<void> {
    // Idempotent: clear previous state
    stop();

    abortController = new AbortController();
    const entries = await fetchAllSources(
      config.sources,
      abortController.signal,
      log,
    );
    blocklistEntries = entries;

    scheduleRefresh();
  }

  function stop(): void {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    if (refreshTimer !== null) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  }

  function isDomainBlockedFn(domain: string): BlockDecision {
    return isDomainBlocked(domain, allowSet, denySet, blocklistEntries);
  }

  return { start, stop, isDomainBlocked: isDomainBlockedFn };
}
