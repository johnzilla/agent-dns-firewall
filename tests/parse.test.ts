import { describe, it, expect } from 'vitest';
import { parseHostsFormat, parseDomainList } from '../src/parse.js';

describe('parseHostsFormat', () => {
  it('parses standard 0.0.0.0 line', () => {
    expect(parseHostsFormat('0.0.0.0 ad.example.com')).toEqual(['ad.example.com']);
  });

  it('parses 127.0.0.1 prefix', () => {
    expect(parseHostsFormat('127.0.0.1 ad.example.com')).toEqual(['ad.example.com']);
  });

  it('skips comment lines', () => {
    expect(parseHostsFormat('# comment\n0.0.0.0 ad.com')).toEqual(['ad.com']);
  });

  it('strips inline comments', () => {
    expect(parseHostsFormat('0.0.0.0 ad.com # tracking')).toEqual(['ad.com']);
  });

  it('skips blank lines', () => {
    expect(parseHostsFormat('\n\n0.0.0.0 ad.com\n\n')).toEqual(['ad.com']);
  });

  it('handles multi-domain lines', () => {
    expect(parseHostsFormat('0.0.0.0 ad1.com ad2.com')).toEqual(['ad1.com', 'ad2.com']);
  });

  it('filters IP-only lines', () => {
    expect(parseHostsFormat('0.0.0.0')).toEqual([]);
  });

  it('filters special hostnames', () => {
    expect(parseHostsFormat('0.0.0.0 localhost')).toEqual([]);
  });

  it('filters localhost.localdomain', () => {
    expect(parseHostsFormat('0.0.0.0 localhost.localdomain')).toEqual([]);
  });

  it('normalizes to lowercase', () => {
    expect(parseHostsFormat('0.0.0.0 AD.COM')).toEqual(['ad.com']);
  });

  it('handles \\r\\n line endings', () => {
    expect(parseHostsFormat('0.0.0.0 ad1.com\r\n0.0.0.0 ad2.com')).toEqual(['ad1.com', 'ad2.com']);
  });

  it('handles mixed IPv6 ::1 prefix', () => {
    expect(parseHostsFormat('::1 localhost')).toEqual([]);
  });
});

describe('parseHostsFormat edge cases (QUAL-01)', () => {
  it('parses tab-separated fields', () => {
    expect(parseHostsFormat('0.0.0.0\tad.com')).toEqual(['ad.com']);
  });

  it('skips whitespace-only lines', () => {
    expect(parseHostsFormat('   \t  \n0.0.0.0 ad.com')).toEqual(['ad.com']);
  });

  it('strips trailing whitespace after domain', () => {
    expect(parseHostsFormat('0.0.0.0 ad.com   ')).toEqual(['ad.com']);
  });
});

describe('parseDomainList edge cases (QUAL-01)', () => {
  it('strips trailing whitespace from domain', () => {
    expect(parseDomainList('  example.com  ')).toEqual(['example.com']);
  });

  it('skips whitespace-only lines between domains', () => {
    expect(parseDomainList('a.com\n   \t  \nb.com')).toEqual(['a.com', 'b.com']);
  });
});

describe('parseDomainList', () => {
  it('parses one domain per line', () => {
    expect(parseDomainList('ad.com\ntracker.com')).toEqual(['ad.com', 'tracker.com']);
  });

  it('skips comment lines', () => {
    expect(parseDomainList('# list\nad.com')).toEqual(['ad.com']);
  });

  it('strips inline comments', () => {
    expect(parseDomainList('ad.com # bad')).toEqual(['ad.com']);
  });

  it('skips blank lines', () => {
    expect(parseDomainList('\n\nad.com\n\n')).toEqual(['ad.com']);
  });

  it('normalizes to lowercase', () => {
    expect(parseDomainList('AD.COM')).toEqual(['ad.com']);
  });

  it('handles \\r\\n line endings', () => {
    expect(parseDomainList('ad.com\r\ntracker.com')).toEqual(['ad.com', 'tracker.com']);
  });
});
