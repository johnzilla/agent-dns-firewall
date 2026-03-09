import { describe, it, expect } from 'vitest';
import { PRESET_STEVENBLACK_UNIFIED, PRESET_HAGEZI_LIGHT } from '../src/presets.js';
import type { BlocklistSource, FirewallConfig } from '../src/types.js';

describe('PRESET_STEVENBLACK_UNIFIED', () => {
  it('has id stevenblack-unified', () => {
    expect(PRESET_STEVENBLACK_UNIFIED.id).toBe('stevenblack-unified');
  });

  it('has hosts format', () => {
    expect(PRESET_STEVENBLACK_UNIFIED.format).toBe('hosts');
  });

  it('points to raw.githubusercontent.com StevenBlack hosts', () => {
    expect(PRESET_STEVENBLACK_UNIFIED.url).toBe(
      'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
    );
  });

  it('satisfies BlocklistSource interface', () => {
    const source: BlocklistSource = PRESET_STEVENBLACK_UNIFIED;
    expect(source).toHaveProperty('id');
    expect(source).toHaveProperty('url');
    expect(source).toHaveProperty('format');
  });
});

describe('PRESET_HAGEZI_LIGHT', () => {
  it('has id hagezi-light', () => {
    expect(PRESET_HAGEZI_LIGHT.id).toBe('hagezi-light');
  });

  it('has domains format', () => {
    expect(PRESET_HAGEZI_LIGHT.format).toBe('domains');
  });

  it('points to raw.githubusercontent.com hagezi light list', () => {
    expect(PRESET_HAGEZI_LIGHT.url).toBe(
      'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/light.txt',
    );
  });

  it('satisfies BlocklistSource interface', () => {
    const source: BlocklistSource = PRESET_HAGEZI_LIGHT;
    expect(source).toHaveProperty('id');
    expect(source).toHaveProperty('url');
    expect(source).toHaveProperty('format');
  });
});

describe('FirewallConfig log callback', () => {
  it('accepts optional log callback', () => {
    const config: FirewallConfig = {
      sources: [],
      log: (level: 'warn' | 'error', message: string) => {
        void level;
        void message;
      },
    };
    expect(config.log).toBeDefined();
  });

  it('allows omitting log callback', () => {
    const config: FirewallConfig = { sources: [] };
    expect(config.log).toBeUndefined();
  });
});
