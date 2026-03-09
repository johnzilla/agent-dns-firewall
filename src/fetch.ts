import type { BlocklistSource } from './types.js';
import { parseHostsFormat, parseDomainList } from './parse.js';
import { buildDomainIndex } from './match.js';

export async function fetchSource(
  source: BlocklistSource,
  signal: AbortSignal,
): Promise<string[]> {
  const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);
  const response = await fetch(source.url, { signal: combinedSignal });
  if (!response.ok) {
    throw new Error(
      `Fetch failed for ${source.id}: HTTP ${response.status}`,
    );
  }
  const text = await response.text();
  return source.format === 'hosts'
    ? parseHostsFormat(text)
    : parseDomainList(text);
}

export async function fetchAllSources(
  sources: BlocklistSource[],
  signal: AbortSignal,
  log: (level: 'warn' | 'error', message: string) => void,
): Promise<Array<{ index: Set<string>; sourceId: string }>> {
  const results = await Promise.allSettled(
    sources.map((source) => fetchSource(source, signal)),
  );

  const entries: Array<{ index: Set<string>; sourceId: string }> = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const source = sources[i];
    if (result.status === 'fulfilled') {
      entries.push({
        index: buildDomainIndex(result.value),
        sourceId: source.id,
      });
    } else {
      const errorMessage =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      log('warn', `Failed to fetch source ${source.id}: ${errorMessage}`);
    }
  }

  return entries;
}
