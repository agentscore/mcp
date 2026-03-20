import { z } from 'zod';
import { apiPost, type ApiError } from '../api-client.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

interface AssessData {
  subject: { chain: string; address: string };
  classification: {
    entity_type: string;
    confidence: number;
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
    version: string;
  };
  decision: string | null;
  decision_reasons: string[];
  on_the_fly: boolean;
  caveats: string[];
}

function formatAssessment(data: AssessData): string {
  const lines: string[] = [];
  const s = data.score;
  const c = data.classification;

  lines.push(`Address: ${data.subject.address} (${data.subject.chain})`);

  if (data.decision) {
    lines.push(`Decision: ${data.decision.toUpperCase()}`);
    if (data.decision_reasons.length > 0) {
      lines.push(`Reasons: ${data.decision_reasons.join('; ')}`);
    }
  }

  if (s.value != null && s.grade) {
    lines.push(`Score: ${s.value}/100 (Grade ${s.grade})`);
  }
  lines.push(`Entity type: ${c.entity_type}`);

  if (s.dimensions) {
    const dimStr = Object.entries(s.dimensions).map(([k, v]) => `${k}: ${v}`).join(', ');
    lines.push(`Dimensions: ${dimStr}`);
  }

  if (data.on_the_fly) lines.push('Note: Score was computed on-the-fly for this request.');

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

export function registerAssessWallet(server: McpServer) {
  server.tool(
    'assess_wallet',
    "Assess a wallet's trustworthiness and get an allow/deny decision. Creates entries for unknown addresses. Requires a paid API key ($100/mo).",
    {
      address: z.string().describe('EVM wallet address (e.g., 0xabc...)'),
      chain: z.string().optional().describe('Blockchain (default: base)'),
      min_grade: z.enum(['A', 'B', 'C', 'D', 'F']).optional().describe('Minimum trust grade required to allow'),
      min_score: z.number().optional().describe('Minimum score required to allow (0-100)'),
      require_verified_payment_activity: z.boolean().optional().describe('Require verified payment activity to allow'),
    },
    async ({ address, chain, min_grade, min_score, require_verified_payment_activity }) => {
      try {
        const body: Record<string, unknown> = { address };
        if (chain) body.chain = chain;

        const policy: Record<string, unknown> = {};
        if (min_grade) policy.min_grade = min_grade;
        if (min_score != null) policy.min_score = min_score;
        if (require_verified_payment_activity != null) policy.require_verified_payment_activity = require_verified_payment_activity;
        if (Object.keys(policy).length > 0) body.policy = policy;

        const data = await apiPost('/v1/assess', body) as AssessData;
        return {
          content: [{ type: 'text' as const, text: formatAssessment(data) }],
        };
      } catch (err) {
        const apiErr = err as ApiError;
        if (apiErr.status === 402) {
          return {
            content: [{
              type: 'text' as const,
              text: 'This tool requires a paid API key ($100/mo). Upgrade at https://agentscore.sh/pricing',
            }],
            isError: true,
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
