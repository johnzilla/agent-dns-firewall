import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchSource, fetchAllSources } from '../src/fetch.js';
import type { BlocklistSource } from '../src/types.js';

function mockFetchResponse(body: string, ok = true, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      text: () => Promise.resolve(body),
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
    });
    // Second source fails
    fetchFn.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: () => Promise.resolve(''),
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
