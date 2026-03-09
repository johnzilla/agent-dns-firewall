export function buildDomainIndex(domains: string[]): Set<string> {
  return new Set(domains);
}

export function isDomainInIndex(domain: string, index: Set<string>): boolean {
  if (index.has(domain)) return true;

  // Suffix walk at label boundaries
  let pos = 0;
  while ((pos = domain.indexOf('.', pos)) !== -1) {
    pos += 1; // skip the dot
    const parent = domain.slice(pos);
    if (index.has(parent)) return true;
  }

  return false;
}
