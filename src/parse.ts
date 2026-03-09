import { normalizeDomain } from './normalize.js';

const IP_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$|^[0:]+[01]?$/;

const SPECIAL_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'local',
  'broadcasthost',
  'ip6-localhost',
  'ip6-loopback',
  'ip6-localnet',
  'ip6-mcastprefix',
  'ip6-allnodes',
  'ip6-allrouters',
  'ip6-allhosts',
]);

export function parseHostsFormat(content: string): string[] {
  const domains: string[] = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const stripped = line.split('#')[0].trim();
    if (!stripped) continue;
    const tokens = stripped.split(/\s+/);
    for (const token of tokens) {
      if (IP_PATTERN.test(token)) continue;
      const normalized = normalizeDomain(token);
      if (normalized && !SPECIAL_HOSTS.has(normalized)) {
        domains.push(normalized);
      }
    }
  }
  return domains;
}

export function parseDomainList(content: string): string[] {
  const domains: string[] = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const stripped = line.split('#')[0].trim();
    if (!stripped) continue;
    const normalized = normalizeDomain(stripped);
    if (normalized) {
      domains.push(normalized);
    }
  }
  return domains;
}
