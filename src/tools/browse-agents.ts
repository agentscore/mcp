import { z } from 'zod';
import { apiGet, type ApiError } from '../api-client.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

interface AgentItem {
  chain: string;
  token_id: number;
  owner_address: string;
  agent_wallet: string | null;
  name: string | null;
  description: string | null;
  metadata_quality: string;
  score: number | null;
  grade: string | null;
  entity_type: string | null;
  endpoint_count: number;
  website_url: string | null;
  github_url: string | null;
  has_candidate_payment_activity: boolean;
  has_verified_payment_activity: boolean;
  agents_sharing_owner?: number;
  updated_at: string;
}

interface AgentsListData {
  items: AgentItem[];
  next_cursor: string | null;
  count: number;
  version: string;
}

function formatAgents(data: AgentsListData): string {
  const lines: string[] = [];
  lines.push(`ERC-8004 Agents (${data.count} total, showing ${data.items.length})`);
  lines.push('');

  for (const a of data.items) {
    const parts: string[] = [];
    parts.push(`#${a.token_id}`);
    if (a.name) parts.push(a.name);
    parts.push(`(${a.chain})`);
    if (a.score != null && a.grade) parts.push(`Score: ${a.score} Grade: ${a.grade}`);
    if (a.entity_type) parts.push(`Type: ${a.entity_type}`);
    parts.push(`Endpoints: ${a.endpoint_count}`);
    if (a.has_verified_payment_activity) parts.push('✓ verified payments');
    else if (a.has_candidate_payment_activity) parts.push('candidate payments');
    if (a.agents_sharing_owner && a.agents_sharing_owner > 1) parts.push(`⚠ Shares owner with ${a.agents_sharing_owner - 1} other agents`);
    lines.push(parts.join(' | '));
  }

  if (data.next_cursor) {
    lines.push('');
    lines.push(`More results available (cursor: ${data.next_cursor})`);
  }

  return lines.join('\n');
}

export function registerBrowseAgents(server: McpServer) {
  server.tool(
    'browse_agents',
    'Browse registered ERC-8004 agents. Filter by chain, score, grade, or entity type. Free tier.',
    {
      chain: z.string().optional().describe('Filter by blockchain (e.g., base)'),
      limit: z.number().min(1).max(25).optional().describe('Number of results (default: 10, max: 25)'),
      min_score: z.number().min(0).max(100).optional().describe('Minimum score filter'),
      grade: z.enum(['A', 'B', 'C', 'D', 'F']).optional().describe('Filter by grade'),
      entity_type: z.enum(['agent', 'service', 'hybrid', 'wallet', 'bot', 'unknown']).optional().describe('Filter by entity type'),
    },
    async ({ chain, limit, min_score, grade, entity_type }) => {
      try {
        const params: Record<string, string> = {};
        params.limit = String(limit ?? 10);
        if (chain) params.chain = chain;
        if (min_score != null) params.min_score = String(min_score);
        if (grade) params.grade = grade;
        if (entity_type) params.entity_type = entity_type;

        const data = await apiGet('/v1/agents', params) as AgentsListData;
        return {
          content: [{ type: 'text' as const, text: formatAgents(data) }],
        };
      } catch (err) {
        const apiErr = err as ApiError;
        const message = apiErr.message ?? (err instanceof Error ? err.message : 'Unknown error');
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
