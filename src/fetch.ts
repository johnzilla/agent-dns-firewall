import type { BlocklistSource } from './types.js';
import { parseHostsFormat, parseDomainList } from './parse.js';
import { buildDomainIndex } from './match.js';

interface CacheEntry {
  etag?: string;
  lastModified?: string;
  domains: string[];
}

const sourceCache = new Map<string, CacheEntry>();

export function clearSourceCache(): void {
  sourceCache.clear();
}

export async function fetchSource(
  source: BlocklistSource,
  signal: AbortSignal,
): Promise<string[]> {
  const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);

  const cached = sourceCache.get(source.url);
  const fetchOptions: RequestInit = { signal: combinedSignal };

  if (cached) {
    const headers: Record<string, string> = {};
    if (cached.etag) {
      headers['If-None-Match'] = cached.etag;
    }
    if (cached.lastModified) {
      headers['If-Modified-Since'] = cached.lastModified;
    }
    if (Object.keys(headers).length > 0) {
      fetchOptions.headers = headers;
    }
  }

  const response = await fetch(source.url, fetchOptions);

  if (response.status === 304 && cached) {
    return cached.domains;
  }

  if (!response.ok) {
    throw new Error(
      `Fetch failed for ${source.id}: HTTP ${response.status}`,
    );
  }

  const text = await response.text();
  const domains = source.format === 'hosts'
    ? parseHostsFormat(text)
    : parseDomainList(text);

  const etag = response.headers.get('etag') ?? undefined;
  const lastModified = response.headers.get('last-modified') ?? undefined;

  if (etag || lastModified) {
    sourceCache.set(source.url, { etag, lastModified, domains });
  }

  return domains;
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
