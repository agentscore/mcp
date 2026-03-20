import { apiGet, type ApiError } from '../api-client.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

interface StatsData {
  version: string;
  as_of_time: string;
  data_semantics: string;
  erc8004?: {
    known_agents: number;
    by_chain: Record<string, number>;
    metadata_quality_distribution: Record<string, number>;
  };
  reputation?: {
    total_addresses: number;
    scored_addresses: number;
    entity_distribution: Record<string, number>;
    score_distribution: Record<string, number>;
  };
  payments: {
    addresses_with_candidate_payment_activity: number;
    addresses_with_verified_payment_activity: number;
    total_candidate_transactions: number;
    total_verified_transactions: number;
    verification_status_summary: Record<string, number>;
  };
  caveats: string[];
}

function formatStats(data: StatsData): string {
  const lines: string[] = [];
  lines.push(`AgentScore Ecosystem Stats (as of ${data.as_of_time})`);
  lines.push('');

  if (data.erc8004) {
    lines.push('--- ERC-8004 Agents ---');
    lines.push(`Known agents: ${data.erc8004.known_agents}`);
    if (Object.keys(data.erc8004.by_chain).length > 0) {
      lines.push(`By chain: ${Object.entries(data.erc8004.by_chain).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    }
    if (Object.keys(data.erc8004.metadata_quality_distribution).length > 0) {
      lines.push(`Metadata quality: ${Object.entries(data.erc8004.metadata_quality_distribution).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    }
    lines.push('');
  }

  if (data.reputation) {
    lines.push('--- Reputation ---');
    lines.push(`Total addresses: ${data.reputation.total_addresses}`);
    lines.push(`Scored addresses: ${data.reputation.scored_addresses}`);
    if (Object.keys(data.reputation.entity_distribution).length > 0) {
      lines.push(`Entity types: ${Object.entries(data.reputation.entity_distribution).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    }
    if (Object.keys(data.reputation.score_distribution).length > 0) {
      lines.push(`Grade distribution: ${Object.entries(data.reputation.score_distribution).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    }
    lines.push('');
  }

  lines.push('--- Payments ---');
  lines.push(`Addresses with candidate payment activity: ${data.payments.addresses_with_candidate_payment_activity}`);
  lines.push(`Addresses with verified payment activity: ${data.payments.addresses_with_verified_payment_activity}`);
  lines.push(`Total candidate transactions: ${data.payments.total_candidate_transactions}`);
  lines.push(`Total verified transactions: ${data.payments.total_verified_transactions}`);

  if (data.caveats.length > 0) {
    lines.push('');
    lines.push(`Caveats: ${data.caveats.join('; ')}`);
  }

  return lines.join('\n');
}

export function registerGetEcosystemStats(server: McpServer) {
  server.tool(
    'get_ecosystem_stats',
    'Returns ecosystem-level statistics about the AgentScore network including ERC-8004 agents, reputation scores, and payment activity.',
    {},
    async () => {
      try {
        const data = await apiGet('/v1/stats') as StatsData;
        return {
          content: [{ type: 'text' as const, text: formatStats(data) }],
        };
      } catch (err) {
        const apiErr = err as ApiError;
        if (apiErr.status === 401) {
          return {
            content: [{ type: 'text' as const, text: `Authentication error: ${apiErr.message}` }],
            isError: true,
          };
        }
        const message = apiErr.message ?? (err instanceof Error ? err.message : 'Unknown error');
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
