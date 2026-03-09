import { describe, it, expect } from 'vitest';
import { buildDomainIndex, isDomainInIndex } from '../src/match.js';

describe('buildDomainIndex', () => {
  it('creates a Set from string array', () => {
    const index = buildDomainIndex(['a.com', 'b.com']);
    expect(index).toBeInstanceOf(Set);
    expect(index.size).toBe(2);
    expect(index.has('a.com')).toBe(true);
    expect(index.has('b.com')).toBe(true);
  });

  it('deduplicates entries', () => {
    const index = buildDomainIndex(['a.com', 'a.com', 'b.com']);
    expect(index.size).toBe(2);
  });
});

describe('isDomainInIndex', () => {
  const index = buildDomainIndex(['malware.test', 'evil.example.com']);

  it('returns true for exact match', () => {
    expect(isDomainInIndex('malware.test', index)).toBe(true);
  });

  it('returns true for subdomain match', () => {
    expect(isDomainInIndex('sub.malware.test', index)).toBe(true);
  });

  it('returns true for deep subdomain match', () => {
    expect(isDomainInIndex('deep.sub.malware.test', index)).toBe(true);
  });

  it('returns false for partial label match (notmalware.test)', () => {
    expect(isDomainInIndex('notmalware.test', index)).toBe(false);
  });

  it('returns false for unrelated domain', () => {
    expect(isDomainInIndex('safe.example.com', index)).toBe(false);
  });

  it('returns false for TLD not in index', () => {
    expect(isDomainInIndex('test', index)).toBe(false);
  });

  it('returns false for any domain with empty index', () => {
    const emptyIndex = buildDomainIndex([]);
    expect(isDomainInIndex('anything.com', emptyIndex)).toBe(false);
  });

  it('matches exact multi-level domain', () => {
    expect(isDomainInIndex('evil.example.com', index)).toBe(true);
  });

  it('matches subdomain of multi-level entry', () => {
    expect(isDomainInIndex('sub.evil.example.com', index)).toBe(true);
  });

  it('does not match parent of multi-level entry', () => {
    expect(isDomainInIndex('example.com', index)).toBe(false);
  });
});
