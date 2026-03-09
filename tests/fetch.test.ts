import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchSource, fetchAllSources, clearSourceCache } from '../src/fetch.js';
import type { BlocklistSource } from '../src/types.js';

function mockFetchResponse(body: string, ok = true, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      text: () => Promise.resolve(body),
      headers: { get: () => null },
    }),
  );
}

const hostsSource: BlocklistSource = {
  id: 'test-hosts',
  url: 'https://example.com/hosts',
  format: 'hosts',
};

const domainsSource: BlocklistSource = {
  id: 'test-domains',
  url: 'https://example.com/domains.txt',
  format: 'domains',
};

describe('fetchSource', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearSourceCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed domain array for hosts-format URL', async () => {
    mockFetchResponse('0.0.0.0 malware.test\n');
    const controller = new AbortController();
    const domains = await fetchSource(hostsSource, controller.signal);
    expect(domains).toEqual(['malware.test']);
  });

  it('returns parsed domain array for domains-format URL', async () => {
    mockFetchResponse('malware.test\n');
    const controller = new AbortController();
    const domains = await fetchSource(domainsSource, controller.signal);
    expect(domains).toEqual(['malware.test']);
  });

  it('throws on non-ok response', async () => {
    mockFetchResponse('', false, 503);
    const controller = new AbortController();
    await expect(fetchSource(hostsSource, controller.signal)).rejects.toThrow(
      /503/,
    );
  });

  it('passes AbortSignal to fetch call', async () => {
    mockFetchResponse('0.0.0.0 ad.test\n');
    const controller = new AbortController();
    await fetchSource(hostsSource, controller.signal);
    const fetchFn = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect(fetchFn).toHaveBeenCalledOnce();
    const callArgs = fetchFn.mock.calls[0];
    expect(callArgs[0]).toBe('https://example.com/hosts');
    // signal should be an AbortSignal
    expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
  });
});

describe('fetchAllSources', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearSourceCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns array of index and sourceId for successful sources', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('malware.test\n'),
        headers: { get: () => null },
      }),
    );
    const controller = new AbortController();
    const log = vi.fn();
    const results = await fetchAllSources(
      [domainsSource],
      controller.signal,
      log,
    );
    expect(results).toHaveLength(1);
    expect(results[0].sourceId).toBe('test-domains');
    expect(results[0].index).toBeInstanceOf(Set);
    expect(results[0].index.has('malware.test')).toBe(true);
  });

  it('logs warning and continues when one source fails', async () => {
    const fetchFn = vi.fn();
    // First source succeeds
    fetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('good.test\n'),
      headers: { get: () => null },
    });
    // Second source fails
    fetchFn.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: () => Promise.resolve(''),
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', fetchFn);

    const controller = new AbortController();
    const log = vi.fn();
    const failSource: BlocklistSource = {
      id: 'fail-source',
      url: 'https://example.com/fail',
      format: 'domains',
    };
    const results = await fetchAllSources(
      [domainsSource, failSource],
      controller.signal,
      log,
    );
    expect(results).toHaveLength(1);
    expect(results[0].sourceId).toBe('test-domains');
    expect(log).toHaveBeenCalled();
  });

  it('returns empty array when all sources fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve(''),
        headers: { get: () => null },
      }),
    );
    const controller = new AbortController();
    const log = vi.fn();
    const results = await fetchAllSources(
      [hostsSource, domainsSource],
      controller.signal,
      log,
    );
    expect(results).toEqual([]);
  });

  it('logs warning for each failed source with source ID in message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve(''),
        headers: { get: () => null },
      }),
    );
    const controller = new AbortController();
    const log = vi.fn();
    await fetchAllSources(
      [hostsSource, domainsSource],
      controller.signal,
      log,
    );
    expect(log).toHaveBeenCalledTimes(2);
    // Each call should have 'warn' level and contain the source ID
    expect(log).toHaveBeenCalledWith('warn', expect.stringContaining('test-hosts'));
    expect(log).toHaveBeenCalledWith('warn', expect.stringContaining('test-domains'));
  });
});

describe('conditional fetching', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearSourceCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('first fetch sends no conditional headers', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('malware.test\n'),
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', fetchFn);

    const controller = new AbortController();
    const domains = await fetchSource(domainsSource, controller.signal);
    expect(domains).toEqual(['malware.test']);

    const callArgs = fetchFn.mock.calls[0];
    const headers = callArgs[1]?.headers;
    // No conditional headers on first request
    expect(headers).toBeUndefined();
  });

  it('sends If-None-Match on subsequent fetch when ETag was present', async () => {
    const fetchFn = vi.fn();
    // First response with ETag
    fetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('malware.test\n'),
      headers: { get: (name: string) => name === 'etag' ? '"abc123"' : null },
    });
    // Second response
    fetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('malware.test\n'),
      headers: { get: (name: string) => name === 'etag' ? '"abc123"' : null },
    });
    vi.stubGlobal('fetch', fetchFn);

    const controller = new AbortController();
    await fetchSource(domainsSource, controller.signal);
    await fetchSource(domainsSource, controller.signal);

    const secondCallHeaders = fetchFn.mock.calls[1][1]?.headers;
    expect(secondCallHeaders).toBeDefined();
    expect(secondCallHeaders['If-None-Match']).toBe('"abc123"');
  });

  it('sends If-Modified-Since on subsequent fetch when Last-Modified was present', async () => {
    const fetchFn = vi.fn();
    fetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('malware.test\n'),
      headers: { get: (name: string) => name === 'last-modified' ? 'Wed, 01 Jan 2025 00:00:00 GMT' : null },
    });
    fetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('malware.test\n'),
      headers: { get: (name: string) => name === 'last-modified' ? 'Wed, 01 Jan 2025 00:00:00 GMT' : null },
    });
    vi.stubGlobal('fetch', fetchFn);

    const controller = new AbortController();
    await fetchSource(domainsSource, controller.signal);
    await fetchSource(domainsSource, controller.signal);

    const secondCallHeaders = fetchFn.mock.calls[1][1]?.headers;
    expect(secondCallHeaders).toBeDefined();
    expect(secondCallHeaders['If-Modified-Since']).toBe('Wed, 01 Jan 2025 00:00:00 GMT');
  });

  it('sends both conditional headers when response has both ETag and Last-Modified', async () => {
    const fetchFn = vi.fn();
    const bothHeaders = (name: string) => {
      if (name === 'etag') return '"xyz789"';
      if (name === 'last-modified') return 'Thu, 02 Jan 2025 00:00:00 GMT';
      return null;
    };
    fetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('malware.test\n'),
      headers: { get: bothHeaders },
    });
    fetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('malware.test\n'),
      headers: { get: bothHeaders },
    });
    vi.stubGlobal('fetch', fetchFn);

    const controller = new AbortController();
    await fetchSource(domainsSource, controller.signal);
    await fetchSource(domainsSource, controller.signal);

    const secondCallHeaders = fetchFn.mock.calls[1][1]?.headers;
    expect(secondCallHeaders['If-None-Match']).toBe('"xyz789"');
    expect(secondCallHeaders['If-Modified-Since']).toBe('Thu, 02 Jan 2025 00:00:00 GMT');
  });

  it('returns cached domains on 304 Not Modified without calling response.text()', async () => {
    const fetchFn = vi.fn();
    fetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('malware.test\n'),
      headers: { get: (name: string) => name === 'etag' ? '"abc123"' : null },
    });
    const textFn = vi.fn().mockResolvedValue('');
    fetchFn.mockResolvedValueOnce({
      ok: false,
      status: 304,
      text: textFn,
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', fetchFn);

    const controller = new AbortController();
    await fetchSource(domainsSource, controller.signal);
    const domains = await fetchSource(domainsSource, controller.signal);

    expect(domains).toEqual(['malware.test']);
    expect(textFn).not.toHaveBeenCalled();
  });

  it('updates cache when server returns 200 after a prior cached response', async () => {
    const fetchFn = vi.fn();
    fetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('old.test\n'),
      headers: { get: (name: string) => name === 'etag' ? '"v1"' : null },
    });
    fetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('new.test\n'),
      headers: { get: (name: string) => name === 'etag' ? '"v2"' : null },
    });
    // Third fetch to verify new ETag is sent
    fetchFn.mockResolvedValueOnce({
      ok: false,
      status: 304,
      text: vi.fn().mockResolvedValue(''),
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', fetchFn);

    const controller = new AbortController();
    await fetchSource(domainsSource, controller.signal);
    const domains = await fetchSource(domainsSource, controller.signal);
    expect(domains).toEqual(['new.test']);

    // Third fetch should use updated ETag
    const cachedDomains = await fetchSource(domainsSource, controller.signal);
    expect(cachedDomains).toEqual(['new.test']);
    expect(fetchFn.mock.calls[2][1]?.headers['If-None-Match']).toBe('"v2"');
  });

  it('different source URLs maintain independent cache entries', async () => {
    const fetchFn = vi.fn();
    // Source A
    fetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('a.test\n'),
      headers: { get: (name: string) => name === 'etag' ? '"etag-a"' : null },
    });
    // Source B
    fetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('b.test\n'),
      headers: { get: (name: string) => name === 'etag' ? '"etag-b"' : null },
    });
    // Source A again (304)
    fetchFn.mockResolvedValueOnce({
      ok: false,
      status: 304,
      text: vi.fn().mockResolvedValue(''),
      headers: { get: () => null },
    });
    // Source B again (304)
    fetchFn.mockResolvedValueOnce({
      ok: false,
      status: 304,
      text: vi.fn().mockResolvedValue(''),
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', fetchFn);

    const sourceA: BlocklistSource = { id: 'a', url: 'https://example.com/a', format: 'domains' };
    const sourceB: BlocklistSource = { id: 'b', url: 'https://example.com/b', format: 'domains' };
    const controller = new AbortController();

    await fetchSource(sourceA, controller.signal);
    await fetchSource(sourceB, controller.signal);
    const domainsA = await fetchSource(sourceA, controller.signal);
    const domainsB = await fetchSource(sourceB, controller.signal);

    expect(domainsA).toEqual(['a.test']);
    expect(domainsB).toEqual(['b.test']);
    expect(fetchFn.mock.calls[2][1]?.headers['If-None-Match']).toBe('"etag-a"');
    expect(fetchFn.mock.calls[3][1]?.headers['If-None-Match']).toBe('"etag-b"');
  });

  it('fetchAllSources returns correct results when some sources return 304 and others 200', async () => {
    const fetchFn = vi.fn();
    const sourceA: BlocklistSource = { id: 'a', url: 'https://example.com/a', format: 'domains' };
    const sourceB: BlocklistSource = { id: 'b', url: 'https://example.com/b', format: 'domains' };
    const controller = new AbortController();
    const log = vi.fn();

    // First round: both 200
    fetchFn.mockResolvedValueOnce({
      ok: true, status: 200,
      text: () => Promise.resolve('a.test\n'),
      headers: { get: (name: string) => name === 'etag' ? '"etag-a"' : null },
    });
    fetchFn.mockResolvedValueOnce({
      ok: true, status: 200,
      text: () => Promise.resolve('b.test\n'),
      headers: { get: (name: string) => name === 'etag' ? '"etag-b"' : null },
    });
    vi.stubGlobal('fetch', fetchFn);

    await fetchAllSources([sourceA, sourceB], controller.signal, log);

    // Second round: A returns 304, B returns 200 with new data
    fetchFn.mockResolvedValueOnce({
      ok: false, status: 304,
      text: vi.fn().mockResolvedValue(''),
      headers: { get: () => null },
    });
    fetchFn.mockResolvedValueOnce({
      ok: true, status: 200,
      text: () => Promise.resolve('b-new.test\n'),
      headers: { get: (name: string) => name === 'etag' ? '"etag-b2"' : null },
    });

    const results = await fetchAllSources([sourceA, sourceB], controller.signal, log);
    expect(results).toHaveLength(2);
    expect(results[0].sourceId).toBe('a');
    expect(results[0].index.has('a.test')).toBe(true);
    expect(results[1].sourceId).toBe('b');
    expect(results[1].index.has('b-new.test')).toBe(true);
  });

  it('fetchAllSources handles a mix of 304s, 200s, and failures', async () => {
    const fetchFn = vi.fn();
    const sourceA: BlocklistSource = { id: 'a', url: 'https://example.com/a', format: 'domains' };
    const sourceB: BlocklistSource = { id: 'b', url: 'https://example.com/b', format: 'domains' };
    const sourceC: BlocklistSource = { id: 'c', url: 'https://example.com/c', format: 'domains' };
    const controller = new AbortController();
    const log = vi.fn();

    // First round: all 200
    fetchFn.mockResolvedValueOnce({
      ok: true, status: 200,
      text: () => Promise.resolve('a.test\n'),
      headers: { get: (name: string) => name === 'etag' ? '"etag-a"' : null },
    });
    fetchFn.mockResolvedValueOnce({
      ok: true, status: 200,
      text: () => Promise.resolve('b.test\n'),
      headers: { get: (name: string) => name === 'etag' ? '"etag-b"' : null },
    });
    fetchFn.mockResolvedValueOnce({
      ok: true, status: 200,
      text: () => Promise.resolve('c.test\n'),
      headers: { get: (name: string) => name === 'etag' ? '"etag-c"' : null },
    });
    vi.stubGlobal('fetch', fetchFn);

    await fetchAllSources([sourceA, sourceB, sourceC], controller.signal, log);

    // Second round: A=304, B=500 (failure), C=200 with new data
    fetchFn.mockResolvedValueOnce({
      ok: false, status: 304,
      text: vi.fn().mockResolvedValue(''),
      headers: { get: () => null },
    });
    fetchFn.mockResolvedValueOnce({
      ok: false, status: 500,
      text: () => Promise.resolve(''),
      headers: { get: () => null },
    });
    fetchFn.mockResolvedValueOnce({
      ok: true, status: 200,
      text: () => Promise.resolve('c-new.test\n'),
      headers: { get: (name: string) => name === 'etag' ? '"etag-c2"' : null },
    });

    const results = await fetchAllSources([sourceA, sourceB, sourceC], controller.signal, log);
    expect(results).toHaveLength(2); // A (cached) + C (new), B failed
    expect(results[0].sourceId).toBe('a');
    expect(results[0].index.has('a.test')).toBe(true);
    expect(results[1].sourceId).toBe('c');
    expect(results[1].index.has('c-new.test')).toBe(true);
    expect(log).toHaveBeenCalledWith('warn', expect.stringContaining('b'));
  });
});
