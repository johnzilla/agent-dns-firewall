import { normalizeDomain } from './normalize.js';
import type { BlockDecision } from './types.js';
import { isDomainInIndex } from './match.js';

export function sanitizeInput(input: unknown): string | null {
  if (input == null || typeof input !== 'string') return null;

  let value = input.trim();
  if (!value) return null;

  // Extract hostname from URL
  if (value.includes('://')) {
    try {
      value = new URL(value).hostname;
    } catch {
      // not a valid URL, continue with raw value
    }
  }

  // Strip port: find last colon that isn't part of IPv6 (after last ']')
  const bracketPos = value.lastIndexOf(']');
  const colonPos = value.lastIndexOf(':');
  if (colonPos > bracketPos) {
    value = value.slice(0, colonPos);
  }

  const normalized = normalizeDomain(value);
  return normalized || null;
}

export function isDomainBlocked(
  input: unknown,
  allowSet: Set<string>,
  denySet: Set<string>,
  blocklistEntries: Array<{ index: Set<string>; sourceId: string }>,
): BlockDecision {
  try {
    const domain = sanitizeInput(input);
    if (!domain) return { blocked: false };

    // Allow takes highest precedence (exact match only)
    if (allowSet.has(domain)) return { blocked: false };

    // Deny is next (exact match only)
    if (denySet.has(domain)) return { blocked: true, reason: 'custom-deny' };

    // Check blocklists (suffix matching via isDomainInIndex)
    for (const entry of blocklistEntries) {
      if (isDomainInIndex(domain, entry.index)) {
        return { blocked: true, reason: 'blocklist', listId: entry.sourceId };
      }
    }

    return { blocked: false };
  } catch {
    return { blocked: false };
  }
}
