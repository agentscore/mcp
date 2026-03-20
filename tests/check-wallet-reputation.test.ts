import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiGet } from '../src/api-client.js';
import { registerCheckWalletReputation } from '../src/tools/check-wallet-reputation.js';

process.env.AGENTSCORE_BASE_URL = 'https://api.test.agentscore.sh';
process.env.AGENTSCORE_API_KEY = 'ask_test_key_123';

vi.mock('../src/api-client.js', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

const mockApiGet = vi.mocked(apiGet);

// Capture the handler by mocking the McpServer
function captureHandler(): (args: Record<string, unknown>) => Promise<unknown> {
  let capturedHandler: ((args: Record<string, unknown>) => Promise<unknown>) | null = null;
  const fakeServer = {
    tool: (_name: string, _desc: string, _schema: unknown, handler: (args: Record<string, unknown>) => Promise<unknown>) => {
      capturedHandler = handler;
    },
  };
  registerCheckWalletReputation(fakeServer as never);
  if (!capturedHandler) throw new Error('Handler not registered');
  return capturedHandler;
}

const handler = captureHandler();

beforeEach(() => {
  mockApiGet.mockReset();
});

const baseReputationData = {
  subject: { chain: 'base', address: '0xabc123' },
  classification: {
    entity_type: 'agent',
    confidence: 0.95,
    is_known: true,
    is_known_erc8004_agent: true,
    has_candidate_payment_activity: true,
    has_verified_payment_activity: true,
    reasons: ['ERC-8004 registered'],
  },
  score: {
    status: 'scored',
    value: 82,
    grade: 'B',
    confidence: 0.9,
    dimensions: { activity: 80, diversity: 85 },
    scored_at: '2024-01-01T00:00:00Z',
    version: '2.0',
  },
  identity: {
    ens_name: 'myagent.eth',
    website_url: 'https://myagent.example.com',
    github_url: null,
    erc8004: {
      chain: 'base',
      token_id: 42,
      name: 'My Agent',
      description: 'A test agent',
      metadata_quality: 'high',
      endpoint_count: 3,
    },
  },
  activity: {
    total_candidate_transactions: 100,
    total_verified_transactions: 80,
    counterparties_count: 25,
    active_months: 6,
  },
  caveats: [],
};

describe('check_wallet_reputation', () => {
  describe('success responses', () => {
    it('formats a fully-scored address correctly', async () => {
      mockApiGet.mockResolvedValueOnce(baseReputationData);

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[] };

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text;

      expect(text).toContain('Address: 0xabc123 (base)');
      expect(text).toContain('Entity type: agent (confidence: 0.95)');
      expect(text).toContain('Score: 82/100 (Grade B, status: scored)');
      expect(text).toContain('Dimensions: activity: 80, diversity: 85');
      expect(text).toContain('Identity: ENS: myagent.eth, ERC-8004: My Agent, Website: https://myagent.example.com');
      expect(text).toContain('Activity: 100 candidate tx, 80 verified tx, 25 counterparties, 6 active months');
      expect(text).toContain('Flags: ERC-8004 agent, verified payments');
    });

    it('omits score line details when score value is null', async () => {
      mockApiGet.mockResolvedValueOnce({
        ...baseReputationData,
        score: { ...baseReputationData.score, value: null, grade: null, dimensions: null, status: 'pending' },
      });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('Score: pending');
      expect(text).not.toContain('/100');
    });

    it('omits identity section when identity is null', async () => {
      mockApiGet.mockResolvedValueOnce({ ...baseReputationData, identity: null });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).not.toContain('Identity:');
      expect(text).not.toContain('ENS:');
    });

    it('omits activity section when activity is null', async () => {
      mockApiGet.mockResolvedValueOnce({ ...baseReputationData, activity: null });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).not.toContain('Activity:');
    });

    it('shows caveats when present', async () => {
      mockApiGet.mockResolvedValueOnce({
        ...baseReputationData,
        caveats: ['Low transaction count', 'Recent account'],
      });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('Caveats: Low transaction count; Recent account');
    });

    it('shows candidate payments flag when only candidate activity', async () => {
      mockApiGet.mockResolvedValueOnce({
        ...baseReputationData,
        classification: {
          ...baseReputationData.classification,
          has_verified_payment_activity: false,
          has_candidate_payment_activity: true,
          is_known_erc8004_agent: false,
        },
      });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('candidate payments');
      expect(text).not.toContain('verified payments');
      expect(text).not.toContain('ERC-8004 agent');
    });

    it('shows ERC-8004 token_id fallback when name is null', async () => {
      mockApiGet.mockResolvedValueOnce({
        ...baseReputationData,
        identity: {
          ...baseReputationData.identity,
          ens_name: null,
          erc8004: { ...baseReputationData.identity!.erc8004!, name: null },
        },
      });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('ERC-8004: #42');
    });
  });

  describe('API endpoint and params', () => {
    it('calls apiGet with encoded address path and no chain param by default', async () => {
      mockApiGet.mockResolvedValueOnce(baseReputationData);

      await handler({ address: '0xabc123' });

      expect(mockApiGet).toHaveBeenCalledOnce();
      expect(mockApiGet).toHaveBeenCalledWith('/v1/reputation/0xabc123', {});
    });

    it('passes chain param when provided', async () => {
      mockApiGet.mockResolvedValueOnce(baseReputationData);

      await handler({ address: '0xabc123', chain: 'ethereum' });

      expect(mockApiGet).toHaveBeenCalledWith('/v1/reputation/0xabc123', { chain: 'ethereum' });
    });

    it('URL-encodes the address in the path', async () => {
      mockApiGet.mockResolvedValueOnce(baseReputationData);

      await handler({ address: '0xabc 123' });

      expect(mockApiGet).toHaveBeenCalledWith('/v1/reputation/0xabc%20123', {});
    });
  });

  describe('error handling', () => {
    it('returns friendly message for 404 unknown_address', async () => {
      mockApiGet.mockRejectedValueOnce({ status: 404, code: 'unknown_address', message: 'Address not yet indexed.' });

      const result = await handler({ address: '0xunknown' }) as { content: { type: string; text: string }[]; isError?: boolean };

      expect(result.content[0].text).toContain('Address not yet indexed');
      expect(result.content[0].text).toContain('assess_wallet');
      expect(result.isError).toBeUndefined();
    });

    it('returns auth error for 401', async () => {
      mockApiGet.mockRejectedValueOnce({ status: 401, code: 'unauthorized', message: 'Invalid API key' });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[]; isError: boolean };

      expect(result.content[0].text).toContain('Authentication error: Invalid API key');
      expect(result.isError).toBe(true);
    });

    it('returns generic error message for other API errors', async () => {
      mockApiGet.mockRejectedValueOnce({ status: 500, code: 'internal_error', message: 'Internal server error' });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[]; isError: boolean };

      expect(result.content[0].text).toContain('Error: Internal server error');
      expect(result.isError).toBe(true);
    });
  });
});
