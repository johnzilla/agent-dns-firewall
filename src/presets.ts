import type { BlocklistSource } from './types.js';

export const PRESET_STEVENBLACK_UNIFIED: BlocklistSource = {
  id: 'stevenblack-unified',
  url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
  format: 'hosts',
};

export const PRESET_HAGEZI_LIGHT: BlocklistSource = {
  id: 'hagezi-light',
  url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/light.txt',
  format: 'domains',
};
