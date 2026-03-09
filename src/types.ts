export interface BlockDecision {
  blocked: boolean;
  reason?: 'custom-deny' | 'blocklist';
  listId?: string;
}

export interface BlocklistSource {
  id: string;
  url: string;
  format: 'hosts' | 'domains';
}

export interface FirewallConfig {
  sources: BlocklistSource[];
  allow?: string[];
  deny?: string[];
  refreshMinutes?: number;
}

export interface DomainFirewall {
  start(): Promise<void>;
  stop(): void;
  isDomainBlocked(domain: string): BlockDecision;
}
