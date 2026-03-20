import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiGet } from '../src/api-client.js';
import { registerGetEcosystemStats } from '../src/tools/get-ecosystem-stats.js';

process.env.AGENTSCORE_BASE_URL = 'https://api.test.agentscore.sh';
process.env.AGENTSCORE_API_KEY = 'ask_test_key_123';

vi.mock('../src/api-client.js', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

const mockApiGet = vi.mocked(apiGet);

function captureHandler(): () => Promise<unknown> {
  let capturedHandler: (() => Promise<unknown>) | null = null;
  const fakeServer = {
    tool: (_name: string, _desc: string, _schema: unknown, handler: () => Promise<unknown>) => {
      capturedHandler = handler;
    },
  };
  registerGetEcosystemStats(fakeServer as never);
  if (!capturedHandler) throw new Error('Handler not registered');
  return capturedHandler;
}

const handler = captureHandler();

beforeEach(() => {
  mockApiGet.mockReset();
});

const baseStatsData = {
  version: '2.0',
  as_of_time: '2024-06-01T12:00:00Z',
  data_semantics: 'cumulative',
  erc8004: {
    known_agents: 512,
    by_chain: { base: 400, ethereum: 112 },
    metadata_quality_distribution: { high: 200, medium: 200, low: 112 },
  },
  reputation: {
    total_addresses: 10000,
    scored_addresses: 7500,
    entity_distribution: { agent: 300, wallet: 5000, bot: 200, unknown: 4500 },
    score_distribution: { A: 500, B: 1500, C: 3000, D: 2000, F: 500 },
  },
  payments: {
    addresses_with_candidate_payment_activity: 1200,
    addresses_with_verified_payment_activity: 800,
    total_candidate_transactions: 50000,
    total_verified_transactions: 30000,
    verification_status_summary: { verified: 30000, pending: 20000 },
  },
  caveats: [],
};

describe('get_ecosystem_stats', () => {
  describe('success responses', () => {
    it('formats the header with as_of_time', async () => {
      mockApiGet.mockResolvedValueOnce(baseStatsData);

      const result = await handler() as { content: { type: string; text: string }[] };

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text;

      expect(text).toContain('AgentScore Ecosystem Stats (as of 2024-06-01T12:00:00Z)');
    });

    it('formats ERC-8004 section with known agents and by_chain', async () => {
      mockApiGet.mockResolvedValueOnce(baseStatsData);

      const result = await handler() as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('--- ERC-8004 Agents ---');
      expect(text).toContain('Known agents: 512');
      expect(text).toContain('By chain:');
      expect(text).toContain('base: 400');
      expect(text).toContain('ethereum: 112');
    });

    it('formats ERC-8004 metadata quality distribution', async () => {
      mockApiGet.mockResolvedValueOnce(baseStatsData);

      const result = await handler() as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('Metadata quality:');
      expect(text).toContain('high: 200');
      expect(text).toContain('medium: 200');
      expect(text).toContain('low: 112');
    });

    it('formats reputation section', async () => {
      mockApiGet.mockResolvedValueOnce(baseStatsData);

      const result = await handler() as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('--- Reputation ---');
      expect(text).toContain('Total addresses: 10000');
      expect(text).toContain('Scored addresses: 7500');
      expect(text).toContain('Entity types:');
      expect(text).toContain('agent: 300');
      expect(text).toContain('Grade distribution:');
      expect(text).toContain('A: 500');
    });

    it('formats payments section', async () => {
      mockApiGet.mockResolvedValueOnce(baseStatsData);

      const result = await handler() as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('--- Payments ---');
      expect(text).toContain('Addresses with candidate payment activity: 1200');
      expect(text).toContain('Addresses with verified payment activity: 800');
      expect(text).toContain('Total candidate transactions: 50000');
      expect(text).toContain('Total verified transactions: 30000');
    });

    it('shows caveats when present', async () => {
      mockApiGet.mockResolvedValueOnce({
        ...baseStatsData,
        caveats: ['Data is 24h delayed', 'Partial chain coverage'],
      });

      const result = await handler() as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('Caveats: Data is 24h delayed; Partial chain coverage');
    });

    it('does not show caveats section when caveats is empty', async () => {
      mockApiGet.mockResolvedValueOnce(baseStatsData);

      const result = await handler() as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).not.toContain('Caveats:');
    });

    it('omits ERC-8004 section when erc8004 is undefined', async () => {
      const { erc8004: _erc8004, ...dataWithoutErc8004 } = baseStatsData;
      mockApiGet.mockResolvedValueOnce(dataWithoutErc8004);

      const result = await handler() as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).not.toContain('ERC-8004 Agents');
      expect(text).not.toContain('Known agents:');
    });

    it('omits reputation section when reputation is undefined', async () => {
      const { reputation: _reputation, ...dataWithoutReputation } = baseStatsData;
      mockApiGet.mockResolvedValueOnce(dataWithoutReputation);

      const result = await handler() as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).not.toContain('--- Reputation ---');
      expect(text).not.toContain('Total addresses:');
    });

    it('skips by_chain line when by_chain is empty', async () => {
      mockApiGet.mockResolvedValueOnce({
        ...baseStatsData,
        erc8004: { ...baseStatsData.erc8004, by_chain: {} },
      });

      const result = await handler() as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).not.toContain('By chain:');
    });

    it('skips entity_distribution line when empty', async () => {
      mockApiGet.mockResolvedValueOnce({
        ...baseStatsData,
        reputation: { ...baseStatsData.reputation, entity_distribution: {} },
      });

      const result = await handler() as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).not.toContain('Entity types:');
    });
  });

  describe('API endpoint', () => {
    it('calls apiGet with /v1/stats and no params', async () => {
      mockApiGet.mockResolvedValueOnce(baseStatsData);

      await handler();

      expect(mockApiGet).toHaveBeenCalledOnce();
      expect(mockApiGet).toHaveBeenCalledWith('/v1/stats');
    });
  });

  describe('error handling', () => {
    it('returns error message for API errors', async () => {
      mockApiGet.mockRejectedValueOnce({ status: 503, code: 'service_unavailable', message: 'Stats service offline' });

      const result = await handler() as { content: { type: string; text: string }[]; isError: boolean };

      expect(result.content[0].text).toContain('Error: Stats service offline');
      expect(result.isError).toBe(true);
    });

    it('returns error message for 401 unauthorized', async () => {
      mockApiGet.mockRejectedValueOnce({ status: 401, code: 'unauthorized', message: 'Bad credentials' });

      const result = await handler() as { content: { type: string; text: string }[]; isError: boolean };

      expect(result.content[0].text).toContain('Error: Bad credentials');
      expect(result.isError).toBe(true);
    });
  });
});
