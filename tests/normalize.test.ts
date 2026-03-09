import { describe, it, expect } from 'vitest';
import { normalizeDomain } from '../src/normalize.js';

describe('normalizeDomain', () => {
  it('lowercases domain', () => {
    expect(normalizeDomain('EXAMPLE.COM')).toBe('example.com');
  });

  it('trims whitespace', () => {
    expect(normalizeDomain('  example.com  ')).toBe('example.com');
  });

  it('strips trailing dot', () => {
    expect(normalizeDomain('example.com.')).toBe('example.com');
  });

  it('handles all three together', () => {
    expect(normalizeDomain('  EXAMPLE.COM.  ')).toBe('example.com');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeDomain('')).toBe('');
  });

  it('passes through already normalized domain unchanged', () => {
    expect(normalizeDomain('example.com')).toBe('example.com');
  });
});
