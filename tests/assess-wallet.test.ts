import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiPost } from '../src/api-client.js';
import { registerAssessWallet } from '../src/tools/assess-wallet.js';

process.env.AGENTSCORE_BASE_URL = 'https://api.test.agentscore.sh';
process.env.AGENTSCORE_API_KEY = 'ask_test_key_123';

vi.mock('../src/api-client.js', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

const mockApiPost = vi.mocked(apiPost);

type HandlerArgs = {
  address: string;
  chain?: string;
  min_grade?: 'A' | 'B' | 'C' | 'D' | 'F';
  min_score?: number;
  require_verified_payment_activity?: boolean;
};

function captureHandler(): (args: HandlerArgs) => Promise<unknown> {
  let capturedHandler: ((args: HandlerArgs) => Promise<unknown>) | null = null;
  const fakeServer = {
    tool: (_name: string, _desc: string, _schema: unknown, handler: (args: HandlerArgs) => Promise<unknown>) => {
      capturedHandler = handler;
    },
  };
  registerAssessWallet(fakeServer as never);
  if (!capturedHandler) throw new Error('Handler not registered');
  return capturedHandler;
}

const handler = captureHandler();

beforeEach(() => {
  mockApiPost.mockReset();
});

const baseAssessData = {
  subject: { chain: 'base', address: '0xabc123' },
  classification: {
    entity_type: 'agent',
    confidence: 0.9,
    is_known_erc8004_agent: true,
    has_candidate_payment_activity: true,
    has_verified_payment_activity: true,
    reasons: ['ERC-8004 registered'],
  },
  score: {
    status: 'scored',
    value: 75,
    grade: 'C',
    confidence: 0.85,
    dimensions: { activity: 70, diversity: 80 },
    version: '2.0',
  },
  decision: 'allow',
  decision_reasons: ['Score meets minimum threshold'],
  on_the_fly: false,
  caveats: [],
};

describe('assess_wallet', () => {
  describe('success responses', () => {
    it('formats a full assessment with decision and score', async () => {
      mockApiPost.mockResolvedValueOnce(baseAssessData);

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[] };

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text;

      expect(text).toContain('Address: 0xabc123 (base)');
      expect(text).toContain('Decision: ALLOW');
      expect(text).toContain('Reasons: Score meets minimum threshold');
      expect(text).toContain('Score: 75/100 (Grade C)');
      expect(text).toContain('Entity type: agent');
      expect(text).toContain('Dimensions: activity: 70, diversity: 80');
    });

    it('shows on_the_fly note when score was computed live', async () => {
      mockApiPost.mockResolvedValueOnce({ ...baseAssessData, on_the_fly: true });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('Note: Score was computed on-the-fly for this request.');
    });

    it('omits on_the_fly note when false', async () => {
      mockApiPost.mockResolvedValueOnce(baseAssessData);

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).not.toContain('on-the-fly');
    });

    it('omits decision section when decision is null', async () => {
      mockApiPost.mockResolvedValueOnce({ ...baseAssessData, decision: null, decision_reasons: [] });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).not.toContain('Decision:');
      expect(text).not.toContain('Reasons:');
    });

    it('shows deny decision uppercased', async () => {
      mockApiPost.mockResolvedValueOnce({
        ...baseAssessData,
        decision: 'deny',
        decision_reasons: ['Score below threshold', 'No verified payments'],
      });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('Decision: DENY');
      expect(text).toContain('Reasons: Score below threshold; No verified payments');
    });

    it('omits score line when value is null', async () => {
      mockApiPost.mockResolvedValueOnce({
        ...baseAssessData,
        score: { ...baseAssessData.score, value: null, grade: null },
      });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).not.toContain('/100');
    });

    it('shows ERC-8004 agent flag', async () => {
      mockApiPost.mockResolvedValueOnce(baseAssessData);

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('Flags: ERC-8004 agent, verified payments');
    });

    it('shows candidate payments flag when no verified activity', async () => {
      mockApiPost.mockResolvedValueOnce({
        ...baseAssessData,
        classification: {
          ...baseAssessData.classification,
          has_verified_payment_activity: false,
          has_candidate_payment_activity: true,
          is_known_erc8004_agent: false,
        },
      });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('candidate payments');
      expect(text).not.toContain('ERC-8004 agent');
    });

    it('shows caveats when present', async () => {
      mockApiPost.mockResolvedValueOnce({ ...baseAssessData, caveats: ['Data may be stale'] });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[] };
      const text = result.content[0].text;

      expect(text).toContain('Caveats: Data may be stale');
    });
  });

  describe('API endpoint and params', () => {
    it('calls apiPost with address only when no optional params', async () => {
      mockApiPost.mockResolvedValueOnce(baseAssessData);

      await handler({ address: '0xabc123' });

      expect(mockApiPost).toHaveBeenCalledOnce();
      expect(mockApiPost).toHaveBeenCalledWith('/v1/assess', { address: '0xabc123' });
    });

    it('includes chain in body when provided', async () => {
      mockApiPost.mockResolvedValueOnce(baseAssessData);

      await handler({ address: '0xabc123', chain: 'ethereum' });

      expect(mockApiPost).toHaveBeenCalledWith('/v1/assess', { address: '0xabc123', chain: 'ethereum' });
    });

    it('includes policy object with min_grade when provided', async () => {
      mockApiPost.mockResolvedValueOnce(baseAssessData);

      await handler({ address: '0xabc123', min_grade: 'B' });

      expect(mockApiPost).toHaveBeenCalledWith('/v1/assess', {
        address: '0xabc123',
        policy: { min_grade: 'B' },
      });
    });

    it('includes policy object with min_score when provided', async () => {
      mockApiPost.mockResolvedValueOnce(baseAssessData);

      await handler({ address: '0xabc123', min_score: 60 });

      expect(mockApiPost).toHaveBeenCalledWith('/v1/assess', {
        address: '0xabc123',
        policy: { min_score: 60 },
      });
    });

    it('includes policy with require_verified_payment_activity when provided', async () => {
      mockApiPost.mockResolvedValueOnce(baseAssessData);

      await handler({ address: '0xabc123', require_verified_payment_activity: true });

      expect(mockApiPost).toHaveBeenCalledWith('/v1/assess', {
        address: '0xabc123',
        policy: { require_verified_payment_activity: true },
      });
    });

    it('combines all policy params when multiple are provided', async () => {
      mockApiPost.mockResolvedValueOnce(baseAssessData);

      await handler({
        address: '0xabc123',
        chain: 'base',
        min_grade: 'A',
        min_score: 80,
        require_verified_payment_activity: false,
      });

      expect(mockApiPost).toHaveBeenCalledWith('/v1/assess', {
        address: '0xabc123',
        chain: 'base',
        policy: { min_grade: 'A', min_score: 80, require_verified_payment_activity: false },
      });
    });

    it('omits policy key entirely when no policy params are provided', async () => {
      mockApiPost.mockResolvedValueOnce(baseAssessData);

      await handler({ address: '0xabc123' });

      const [, body] = mockApiPost.mock.calls[0];
      expect((body as Record<string, unknown>).policy).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('returns payment required message for 402', async () => {
      mockApiPost.mockRejectedValueOnce({ status: 402, code: 'payment_required', message: 'Paid plan required' });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[]; isError: boolean };

      expect(result.content[0].text).toContain('paid API key ($100/mo)');
      expect(result.content[0].text).toContain('https://agentscore.sh/pricing');
      expect(result.isError).toBe(true);
    });

    it('returns auth error for 401', async () => {
      mockApiPost.mockRejectedValueOnce({ status: 401, code: 'unauthorized', message: 'Invalid API key' });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[]; isError: boolean };

      expect(result.content[0].text).toContain('Authentication error: Invalid API key');
      expect(result.isError).toBe(true);
    });

    it('returns generic error for other API errors', async () => {
      mockApiPost.mockRejectedValueOnce({ status: 500, code: 'internal_error', message: 'Server meltdown' });

      const result = await handler({ address: '0xabc123' }) as { content: { type: string; text: string }[]; isError: boolean };

      expect(result.content[0].text).toContain('Error: Server meltdown');
      expect(result.isError).toBe(true);
    });
  });
});
