import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDomainFirewall } from '../src/firewall.js';
import type { FirewallConfig } from '../src/types.js';

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

const hostsBody = '0.0.0.0 malware.test\n0.0.0.0 ads.tracker.test\n';
const hostsBodyUpdated = '0.0.0.0 new-malware.test\n';

const baseConfig: FirewallConfig = {
  sources: [
    { id: 'test-hosts', url: 'https://example.com/hosts', format: 'hosts' },
  ],
};

describe('createDomainFirewall', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('factory shape', () => {
    it('returns object with start, stop, and isDomainBlocked methods', () => {
      const fw = createDomainFirewall(baseConfig);
      expect(typeof fw.start).toBe('function');
      expect(typeof fw.stop).toBe('function');
      expect(typeof fw.isDomainBlocked).toBe('function');
    });
  });

  describe('before start()', () => {
    it('isDomainBlocked returns { blocked: false } before start() is called', () => {
      const fw = createDomainFirewall(baseConfig);
      const result = fw.isDomainBlocked('malware.test');
      expect(result).toEqual({ blocked: false });
    });
  });

  describe('start and query', () => {
    it('after start(), blocklist domains are blocked', async () => {
      mockFetchResponse(hostsBody);
      const fw = createDomainFirewall(baseConfig);
      await fw.start();
      expect(fw.isDomainBlocked('malware.test').blocked).toBe(true);
      expect(fw.isDomainBlocked('ads.tracker.test').blocked).toBe(true);
    });

    it('non-blocklisted domains are not blocked after start()', async () => {
      mockFetchResponse(hostsBody);
      const fw = createDomainFirewall(baseConfig);
      await fw.start();
      expect(fw.isDomainBlocked('safe.example.com').blocked).toBe(false);
    });
  });

  describe('allow list', () => {
    it('allow list domains are not blocked even when in blocklist', async () => {
      mockFetchResponse(hostsBody);
      const fw = createDomainFirewall({
        ...baseConfig,
        allow: ['malware.test'],
      });
      await fw.start();
      expect(fw.isDomainBlocked('malware.test').blocked).toBe(false);
    });
  });

  describe('deny list', () => {
    it('deny list domains are always blocked', async () => {
      mockFetchResponse(hostsBody);
      const fw = createDomainFirewall({
        ...baseConfig,
        deny: ['custom-blocked.test'],
      });
      await fw.start();
      const result = fw.isDomainBlocked('custom-blocked.test');
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('custom-deny');
    });
  });

  describe('idempotent start', () => {
    it('start() is idempotent -- calling twice does not create duplicate timers', async () => {
      mockFetchResponse(hostsBody);
      const fw = createDomainFirewall({
        ...baseConfig,
        refreshMinutes: 5,
      });
      await fw.start();
      await fw.start();

      // Only one timer should be active -- fetch count after one interval
      const fetchFn = globalThis.fetch as ReturnType<typeof vi.fn>;
      const callsAfterStart = fetchFn.mock.calls.length;

      // Advance one refresh interval
      await vi.advanceTimersByTimeAsync(5 * 60_000);

      // Should have exactly one additional fetch call (not two)
      expect(fetchFn.mock.calls.length - callsAfterStart).toBe(1);
    });
  });

  describe('stop cleanup', () => {
    it('stop() clears refresh timer', async () => {
      mockFetchResponse(hostsBody);
      const fw = createDomainFirewall({
        ...baseConfig,
        refreshMinutes: 5,
      });
      await fw.start();
      const fetchFn = globalThis.fetch as ReturnType<typeof vi.fn>;
      const callsAfterStart = fetchFn.mock.calls.length;

      fw.stop();

      // Advance past refresh interval -- no new fetch should happen
      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(fetchFn.mock.calls.length).toBe(callsAfterStart);
    });

    it('stop() aborts in-flight fetch', async () => {
      // Make fetch hang until aborted
      let capturedSignal: AbortSignal | null = null;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((_url: string, init: RequestInit) => {
          capturedSignal = init.signal ?? null;
          return new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          });
        }),
      );

      const fw = createDomainFirewall(baseConfig);
      const startPromise = fw.start();

      // Wait a microtask so fetch is called
      await vi.advanceTimersByTimeAsync(0);
      expect(capturedSignal).not.toBeNull();

      fw.stop();

      // start() resolves (fetchAllSources handles abort via allSettled)
      await startPromise;
      expect(capturedSignal!.aborted).toBe(true);
    });
  });

  describe('refresh behavior', () => {
    it('refresh re-fetches and atomically swaps blocklist', async () => {
      const fetchFn = vi.fn();
      // First fetch returns original hosts
      fetchFn.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(hostsBody),
      });
      // Second fetch (refresh) returns updated hosts
      fetchFn.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(hostsBodyUpdated),
      });
      vi.stubGlobal('fetch', fetchFn);

      const fw = createDomainFirewall({
        ...baseConfig,
        refreshMinutes: 5,
      });
      await fw.start();
      expect(fw.isDomainBlocked('malware.test').blocked).toBe(true);

      // Advance to trigger refresh
      await vi.advanceTimersByTimeAsync(5 * 60_000);

      // Old domain should be gone, new domain should be present
      expect(fw.isDomainBlocked('malware.test').blocked).toBe(false);
      expect(fw.isDomainBlocked('new-malware.test').blocked).toBe(true);
    });

    it('on refresh failure, previous blocklist is preserved', async () => {
      const fetchFn = vi.fn();
      // First fetch succeeds
      fetchFn.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(hostsBody),
      });
      // Second fetch (refresh) fails
      fetchFn.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve(''),
      });
      vi.stubGlobal('fetch', fetchFn);

      const log = vi.fn();
      const fw = createDomainFirewall({
        ...baseConfig,
        refreshMinutes: 5,
        log,
      });
      await fw.start();
      expect(fw.isDomainBlocked('malware.test').blocked).toBe(true);

      // Trigger refresh that will fail
      await vi.advanceTimersByTimeAsync(5 * 60_000);

      // Previous blocklist should be preserved
      expect(fw.isDomainBlocked('malware.test').blocked).toBe(true);
    });
  });

  describe('logging', () => {
    it('default log callback uses console.warn and console.error', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Make fetch fail to trigger a log call
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve(''),
        }),
      );

      const fw = createDomainFirewall(baseConfig);
      await fw.start();

      // fetchAllSources logs 'warn' for failed sources using default logger
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('custom log callback receives warnings on fetch failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve(''),
        }),
      );

      const log = vi.fn();
      const fw = createDomainFirewall({ ...baseConfig, log });
      await fw.start();

      expect(log).toHaveBeenCalledWith('warn', expect.stringContaining('test-hosts'));
    });
  });
});
