export type { BlockDecision, BlocklistSource, FirewallConfig, DomainFirewall } from './types.js';
export { normalizeDomain } from './normalize.js';
export { parseHostsFormat, parseDomainList } from './parse.js';
export { buildDomainIndex, isDomainInIndex } from './match.js';
export { sanitizeInput, isDomainBlocked } from './decide.js';
export { createDomainFirewall } from './firewall.js';
export { PRESET_STEVENBLACK_UNIFIED, PRESET_HAGEZI_LIGHT } from './presets.js';
