import { describe, it, expect } from 'vitest';
import { sanitizeInput, isDomainBlocked } from '../src/decide.js';
import { buildDomainIndex } from '../src/match.js';

// Helper to build a decision context
function makeContext(opts: {
  allow?: string[];
  deny?: string[];
  blocklists?: Array<{ id: string; domains: string[] }>;
}) {
  const allowSet = new Set(opts.allow ?? []);
  const denySet = new Set(opts.deny ?? []);
  const blocklistEntries = (opts.blocklists ?? []).map((bl) => ({
    index: buildDomainIndex(bl.domains),
    sourceId: bl.id,
  }));
  return { allowSet, denySet, blocklistEntries };
}

function check(domain: unknown, ctx: ReturnType<typeof makeContext>) {
  return isDomainBlocked(domain, ctx.allowSet, ctx.denySet, ctx.blocklistEntries);
}

describe('sanitizeInput', () => {
  it('returns null for null', () => {
    expect(sanitizeInput(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(sanitizeInput(undefined)).toBeNull();
  });

  it('returns null for non-string', () => {
    expect(sanitizeInput(123)).toBeNull();
    expect(sanitizeInput({})).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(sanitizeInput('')).toBeNull();
  });

  it('returns null for whitespace-only', () => {
    expect(sanitizeInput('   ')).toBeNull();
  });

  it('normalizes a plain domain', () => {
    expect(sanitizeInput('EXAMPLE.COM')).toBe('example.com');
  });

  it('extracts hostname from URL', () => {
    expect(sanitizeInput('https://evil.com/path')).toBe('evil.com');
  });

  it('strips port from domain', () => {
    expect(sanitizeInput('evil.com:8080')).toBe('evil.com');
  });

  it('strips trailing dot', () => {
    expect(sanitizeInput('example.com.')).toBe('example.com');
  });
});

describe('isDomainBlocked', () => {
  describe('BlockDecision shape (MATCH-03)', () => {
    it('blocked by blocklist returns correct shape', () => {
      const ctx = makeContext({
        blocklists: [{ id: 'test-list', domains: ['malware.test'] }],
      });
      const result = check('malware.test', ctx);
      expect(result).toEqual({ blocked: true, reason: 'blocklist', listId: 'test-list' });
    });

    it('blocked by deny returns correct shape', () => {
      const ctx = makeContext({ deny: ['evil.com'] });
      const result = check('evil.com', ctx);
      expect(result).toEqual({ blocked: true, reason: 'custom-deny' });
    });

    it('not blocked returns correct shape', () => {
      const ctx = makeContext({});
      const result = check('safe.com', ctx);
      expect(result).toEqual({ blocked: false });
    });
  });

  describe('Allow override (OVER-01)', () => {
    it('allow overrides blocklist', () => {
      const ctx = makeContext({
        allow: ['google.com'],
        blocklists: [{ id: 'bl', domains: ['google.com'] }],
      });
      expect(check('google.com', ctx).blocked).toBe(false);
    });

    it('allow overrides deny', () => {
      const ctx = makeContext({
        allow: ['google.com'],
        deny: ['google.com'],
      });
      expect(check('google.com', ctx).blocked).toBe(false);
    });

    it('allow uses exact match only -- subdomain not allowed', () => {
      const ctx = makeContext({
        allow: ['google.com'],
        blocklists: [{ id: 'bl', domains: ['google.com'] }],
      });
      expect(check('ads.google.com', ctx).blocked).toBe(true);
    });
  });

  describe('Deny override (OVER-02)', () => {
    it('deny blocks when not in allow', () => {
      const ctx = makeContext({ deny: ['evil.com'] });
      const result = check('evil.com', ctx);
      expect(result).toEqual({ blocked: true, reason: 'custom-deny' });
    });

    it('deny uses exact match only -- subdomain not denied', () => {
      const ctx = makeContext({ deny: ['evil.com'] });
      expect(check('sub.evil.com', ctx).blocked).toBe(false);
    });
  });

  describe('Precedence (OVER-03)', () => {
    it('allow > deny > blocklist -- domain in all three is NOT blocked', () => {
      const ctx = makeContext({
        allow: ['test.com'],
        deny: ['test.com'],
        blocklists: [{ id: 'bl', domains: ['test.com'] }],
      });
      expect(check('test.com', ctx).blocked).toBe(false);
    });

    it('deny > blocklist -- domain in deny and blocklist uses custom-deny', () => {
      const ctx = makeContext({
        deny: ['test.com'],
        blocklists: [{ id: 'bl', domains: ['test.com'] }],
      });
      const result = check('test.com', ctx);
      expect(result).toEqual({ blocked: true, reason: 'custom-deny' });
    });

    it('blocklist only', () => {
      const ctx = makeContext({
        blocklists: [{ id: 'bl', domains: ['test.com'] }],
      });
      const result = check('test.com', ctx);
      expect(result).toEqual({ blocked: true, reason: 'blocklist', listId: 'bl' });
    });

    it('domain in nothing is not blocked', () => {
      const ctx = makeContext({});
      expect(check('test.com', ctx).blocked).toBe(false);
    });
  });

  describe('Resilience (RESL-02)', () => {
    const ctx = makeContext({});

    it('handles null input', () => {
      expect(check(null, ctx)).toEqual({ blocked: false });
    });

    it('handles undefined input', () => {
      expect(check(undefined, ctx)).toEqual({ blocked: false });
    });

    it('handles empty string', () => {
      expect(check('', ctx)).toEqual({ blocked: false });
    });

    it('handles number input', () => {
      expect(check(123, ctx)).toEqual({ blocked: false });
    });

    it('handles object input', () => {
      expect(check({}, ctx)).toEqual({ blocked: false });
    });

    it('never throws', () => {
      expect(() => check(null, ctx)).not.toThrow();
      expect(() => check(undefined, ctx)).not.toThrow();
      expect(() => check('', ctx)).not.toThrow();
      expect(() => check(123 as any, ctx)).not.toThrow();
      expect(() => check({} as any, ctx)).not.toThrow();
    });
  });

  describe('Input sanitization', () => {
    it('extracts hostname from URL', () => {
      const ctx = makeContext({ deny: ['evil.com'] });
      expect(check('https://evil.com/path', ctx).blocked).toBe(true);
    });

    it('strips port', () => {
      const ctx = makeContext({ deny: ['evil.com'] });
      expect(check('evil.com:8080', ctx).blocked).toBe(true);
    });

    it('normalizes to lowercase', () => {
      const ctx = makeContext({ deny: ['evil.com'] });
      expect(check('EVIL.COM', ctx).blocked).toBe(true);
    });

    it('checks IP address as normal string', () => {
      const ctx = makeContext({
        blocklists: [{ id: 'bl', domains: ['192.168.1.1'] }],
      });
      expect(check('192.168.1.1', ctx).blocked).toBe(true);
    });
  });

  describe('Blocklist source identification', () => {
    it('identifies first source when matched', () => {
      const ctx = makeContext({
        blocklists: [
          { id: 'list-a', domains: ['malware.test'] },
          { id: 'list-b', domains: ['other.test'] },
        ],
      });
      const result = check('malware.test', ctx);
      expect(result.listId).toBe('list-a');
    });

    it('identifies second source when not in first', () => {
      const ctx = makeContext({
        blocklists: [
          { id: 'list-a', domains: ['malware.test'] },
          { id: 'list-b', domains: ['other.test'] },
        ],
      });
      const result = check('other.test', ctx);
      expect(result.listId).toBe('list-b');
    });
  });
});
