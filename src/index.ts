export type { BlockDecision, BlocklistSource, FirewallConfig, DomainFirewall } from './types.js';
export { normalizeDomain } from './normalize.js';
export { parseHostsFormat, parseDomainList } from './parse.js';
export { buildDomainIndex, isDomainInIndex } from './match.js';
export { sanitizeInput, isDomainBlocked } from './decide.js';
