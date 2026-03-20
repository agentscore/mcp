import { z } from 'zod';
import { apiGet, type ApiError } from '../api-client.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

interface ReputationData {
  subject: { chain: string; address: string };
  classification: {
    entity_type: string;
    confidence: number;
    is_known: boolean;
    is_known_erc8004_agent: boolean;
    has_candidate_payment_activity: boolean;
    has_verified_payment_activity: boolean;
    reasons: string[];
  };
  score: {
    status: string;
    value: number | null;
    grade: string | null;
    confidence: number | null;
    dimensions: Record<string, number> | null;
    scored_at: string | null;
    version: string;
  };
  identity: {
    ens_name: string | null;
    website_url: string | null;
    github_url: string | null;
    erc8004: {
      chain: string;
      token_id: number;
      name: string | null;
      description: string | null;
      metadata_quality: string | null;
      endpoint_count: number;
    } | null;
  } | null;
  activity: {
    total_candidate_transactions: number;
    total_verified_transactions: number;
    counterparties_count: number;
    active_months: number;
  } | null;
  caveats: string[];
}

function formatReputation(data: ReputationData): string {
  const lines: string[] = [];
  const s = data.score;
  const c = data.classification;

  lines.push(`Address: ${data.subject.address} (${data.subject.chain})`);
  lines.push(`Entity type: ${c.entity_type} (confidence: ${c.confidence})`);

  if (s.value != null && s.grade) {
    lines.push(`Score: ${s.value}/100 (Grade ${s.grade}, status: ${s.status})`);
  } else {
    lines.push(`Score: ${s.status}`);
  }

  if (s.dimensions) {
    const dimStr = Object.entries(s.dimensions).map(([k, v]) => `${k}: ${v}`).join(', ');
    lines.push(`Dimensions: ${dimStr}`);
  }

  // Identity
  const id = data.identity;
  if (id) {
    const idParts: string[] = [];
    if (id.ens_name) idParts.push(`ENS: ${id.ens_name}`);
    if (id.erc8004) idParts.push(`ERC-8004: ${id.erc8004.name ?? `#${id.erc8004.token_id}`}`);
    if (id.website_url) idParts.push(`Website: ${id.website_url}`);
    if (idParts.length > 0) lines.push(`Identity: ${idParts.join(', ')}`);
  }

  // Activity
  const a = data.activity;
  if (a) {
    lines.push(`Activity: ${a.total_candidate_transactions} candidate tx, ${a.total_verified_transactions} verified tx, ${a.counterparties_count} counterparties, ${a.active_months} active months`);
  }

  // Classification flags
  const flags: string[] = [];
  if (c.is_known_erc8004_agent) flags.push('ERC-8004 agent');
  if (c.has_verified_payment_activity) flags.push('verified payments');
  else if (c.has_candidate_payment_activity) flags.push('candidate payments');
  if (flags.length > 0) lines.push(`Flags: ${flags.join(', ')}`);

  if (data.caveats.length > 0) {
    lines.push(`Caveats: ${data.caveats.join('; ')}`);
  }

  return lines.join('\n');
}

export function registerCheckWalletReputation(server: McpServer) {
  server.tool(
    'check_wallet_reputation',
    'Look up the cached trust reputation for a wallet address. Returns score, grade, classification, and activity data. Free tier — read-only, no writes.',
    {
      address: z.string().describe('EVM wallet address (e.g., 0xabc...)'),
      chain: z.string().optional().describe('Blockchain (default: base)'),
    },
    async ({ address, chain }) => {
      try {
        const params: Record<string, string> = {};
        if (chain) params.chain = chain;
        const data = await apiGet(`/v1/reputation/${encodeURIComponent(address)}`, params) as ReputationData;
        return {
          content: [{ type: 'text' as const, text: formatReputation(data) }],
        };
      } catch (err) {
        const apiErr = err as ApiError;
        if (apiErr.status === 404 && apiErr.code === 'unknown_address') {
          return {
            content: [{
              type: 'text' as const,
              text: 'Address not yet indexed. Use assess_wallet (paid) to assess unknown addresses on-the-fly.',
            }],
          };
        }
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
