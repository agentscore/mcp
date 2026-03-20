import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiGet } from '../src/api-client.js';
import { registerBrowseAgents } from '../src/tools/browse-agents.js';

process.env.AGENTSCORE_BASE_URL = 'https://api.test.agentscore.sh';
process.env.AGENTSCORE_API_KEY = 'ask_test_key_123';

vi.mock('../src/api-client.js', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

const mockApiGet = vi.mocked(apiGet);

type HandlerArgs = {
  chain?: string;
  limit?: number;
  min_score?: number;
  grade?: 'A' | 'B' | 'C' | 'D' | 'F';
  entity_type?: 'agent' | 'service' | 'hybrid' | 'wallet' | 'bot' | 'unknown';
};

function captureHandler(): (args: HandlerArgs) => Promise<unknown> {
  let capturedHandler: ((args: HandlerArgs) => Promise<unknown>) | null = null;
  const fakeServer = {
    tool: (_name: string, _desc: string, _schema: unknown, handler: (args: HandlerArgs) => Promise<unknown>) => {
      capturedHandler = handler;
    },
  };
  registerBrowseAgents(fakeServer as never);
  if (!capturedHandler) throw new Error('Handler not registered');
  return capturedHandler;
}

const handler = captureHandler();

beforeEach(() => {
  mockApiGet.mockReset();
});

const baseAgentItem = {
  chain: 'base',
  token_id: 7,
  owner_address: '0xowner',
  agent_wallet: '0xwallet',
  name: 'Alpha Agent',
  description: 'A capable agent',
  metadata_quality: 'high',
  score: 88,
  grade: 'A',
  entity_type: 'agent',
  endpoint_count: 4,
  website_url: 'https://alphaagent.example.com',
  github_url: null,
  has_candidate_payment_activity: true,
  has_verified_payment_activity: true,
  agents_sharing_owner: 1,
  updated_at: '2024-01-01T00:00:00Z',
};

const baseAgentsListData = {
  items: [baseAgentItem],
  next_cursor: null,
  count: 1,
  version: '2.0',
};

describe('browse_agents', () => {
  describe('success responses', () => {
    it('formats agent list with count header', async () => {
      mockApiGet.mockResolvedValueOnce(baseAgentsListData);

      const result = await handler({}) as { content: { type: string; text: string }[] };

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text;

      expect(text).toContain('ERC-8004 Agents (1 total, showing 1)');
    });

    it('formats agent row with score, grade, entity type, endpoint count', async () => {
      mockApiGet.mockResolvedValueOnce(baseAgentsListData);

      const result = await handler({}) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('#7');
      expect(text).toContain('Alpha Agent');
      expect(text).toContain('(base)');
      expect(text).toContain('Score: 88 Grade: A');
      expect(text).toContain('Type: agent');
      expect(text).toContain('Endpoints: 4');
      expect(text).toContain('verified payments');
    });

    it('shows cursor when more results are available', async () => {
      mockApiGet.mockResolvedValueOnce({ ...baseAgentsListData, next_cursor: 'cursor_xyz_456' });

      const result = await handler({}) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('More results available (cursor: cursor_xyz_456)');
    });

    it('does not show cursor line when next_cursor is null', async () => {
      mockApiGet.mockResolvedValueOnce(baseAgentsListData);

      const result = await handler({}) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).not.toContain('More results available');
    });

    it('shows candidate payments when only candidate activity', async () => {
      mockApiGet.mockResolvedValueOnce({
        ...baseAgentsListData,
        items: [{
          ...baseAgentItem,
          has_verified_payment_activity: false,
          has_candidate_payment_activity: true,
        }],
      });

      const result = await handler({}) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('candidate payments');
      expect(text).not.toContain('verified payments');
    });

    it('shows owner sharing warning when agents_sharing_owner > 1', async () => {
      mockApiGet.mockResolvedValueOnce({
        ...baseAgentsListData,
        items: [{ ...baseAgentItem, agents_sharing_owner: 3 }],
      });

      const result = await handler({}) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('Shares owner with 2 other agents');
    });

    it('does not show owner sharing warning when agents_sharing_owner is 1', async () => {
      mockApiGet.mockResolvedValueOnce(baseAgentsListData);

      const result = await handler({}) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).not.toContain('Shares owner');
    });

    it('omits name from row when agent name is null', async () => {
      mockApiGet.mockResolvedValueOnce({
        ...baseAgentsListData,
        items: [{ ...baseAgentItem, name: null }],
      });

      const result = await handler({}) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('#7');
      expect(text).not.toContain('Alpha Agent');
    });

    it('omits score/grade when score is null', async () => {
      mockApiGet.mockResolvedValueOnce({
        ...baseAgentsListData,
        items: [{ ...baseAgentItem, score: null, grade: null }],
      });

      const result = await handler({}) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).not.toContain('Score:');
      expect(text).not.toContain('Grade:');
    });

    it('handles empty items list', async () => {
      mockApiGet.mockResolvedValueOnce({ items: [], next_cursor: null, count: 0, version: '2.0' });

      const result = await handler({}) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('ERC-8004 Agents (0 total, showing 0)');
    });

    it('renders multiple agents', async () => {
      const secondAgent = { ...baseAgentItem, token_id: 99, name: 'Beta Bot', entity_type: 'bot' };
      mockApiGet.mockResolvedValueOnce({ ...baseAgentsListData, items: [baseAgentItem, secondAgent], count: 2 });

      const result = await handler({}) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('ERC-8004 Agents (2 total, showing 2)');
      expect(text).toContain('#7');
      expect(text).toContain('#99');
      expect(text).toContain('Beta Bot');
    });
  });

  describe('API endpoint and params', () => {
    it('calls apiGet with default limit=10 when no params provided', async () => {
      mockApiGet.mockResolvedValueOnce(baseAgentsListData);

      await handler({});

      expect(mockApiGet).toHaveBeenCalledOnce();
      expect(mockApiGet).toHaveBeenCalledWith('/v1/agents', { limit: '10' });
    });

    it('passes custom limit as string', async () => {
      mockApiGet.mockResolvedValueOnce(baseAgentsListData);

      await handler({ limit: 25 });

      expect(mockApiGet).toHaveBeenCalledWith('/v1/agents', { limit: '25' });
    });

    it('passes chain filter when provided', async () => {
      mockApiGet.mockResolvedValueOnce(baseAgentsListData);

      await handler({ chain: 'ethereum' });

      expect(mockApiGet).toHaveBeenCalledWith('/v1/agents', { limit: '10', chain: 'ethereum' });
    });

    it('passes min_score filter as string', async () => {
      mockApiGet.mockResolvedValueOnce(baseAgentsListData);

      await handler({ min_score: 70 });

      expect(mockApiGet).toHaveBeenCalledWith('/v1/agents', { limit: '10', min_score: '70' });
    });

    it('passes grade filter when provided', async () => {
      mockApiGet.mockResolvedValueOnce(baseAgentsListData);

      await handler({ grade: 'A' });

      expect(mockApiGet).toHaveBeenCalledWith('/v1/agents', { limit: '10', grade: 'A' });
    });

    it('passes entity_type filter when provided', async () => {
      mockApiGet.mockResolvedValueOnce(baseAgentsListData);

      await handler({ entity_type: 'service' });

      expect(mockApiGet).toHaveBeenCalledWith('/v1/agents', { limit: '10', entity_type: 'service' });
    });

    it('combines all filters when all provided', async () => {
      mockApiGet.mockResolvedValueOnce(baseAgentsListData);

      await handler({ chain: 'base', limit: 5, min_score: 50, grade: 'B', entity_type: 'hybrid' });

      expect(mockApiGet).toHaveBeenCalledWith('/v1/agents', {
        limit: '5',
        chain: 'base',
        min_score: '50',
        grade: 'B',
        entity_type: 'hybrid',
      });
    });
  });

  describe('error handling', () => {
    it('returns error message for API errors', async () => {
      mockApiGet.mockRejectedValueOnce({ status: 500, code: 'internal_error', message: 'Database unavailable' });

      const result = await handler({}) as { content: { type: string; text: string }[]; isError: boolean };

      expect(result.content[0].text).toContain('Error: Database unavailable');
      expect(result.isError).toBe(true);
    });

    it('returns error message for 401 unauthorized', async () => {
      mockApiGet.mockRejectedValueOnce({ status: 401, code: 'unauthorized', message: 'Invalid API key' });

      const result = await handler({}) as { content: { type: string; text: string }[]; isError: boolean };

      expect(result.content[0].text).toContain('Error: Invalid API key');
      expect(result.isError).toBe(true);
    });
  });
});
