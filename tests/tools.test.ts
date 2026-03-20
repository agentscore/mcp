import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set env BEFORE importing modules (api-client.ts checks at module level)
process.env.AGENTSCORE_BASE_URL = 'https://api.test.agentscore.sh';
process.env.AGENTSCORE_API_KEY = 'ask_test_key_123';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { apiGet, apiPost } = await import('../src/api-client.js');

function mockResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('apiGet', () => {
  it('makes a GET request with Authorization: Bearer header', async () => {
    const mockData = { subject: { chain: 'base', address: '0xabc' }, score: { value: 82 } };
    mockFetch.mockResolvedValueOnce(mockResponse(mockData));

    const result = await apiGet('/v1/reputation/0xabc', { chain: 'base' });

    expect(result).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test.agentscore.sh/v1/reputation/0xabc?chain=base');
    expect(opts.headers['Authorization']).toBe('Bearer ask_test_key_123');
    expect(opts.headers['Accept']).toBe('application/json');
    expect(opts.headers['User-Agent']).toBe(`agentscore-mcp/${__VERSION__}`);
    // Must NOT have x-api-key
    expect(opts.headers['x-api-key']).toBeUndefined();
  });

  it('throws ApiError on non-OK response with error body', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: { code: 'unknown_address', message: 'Address not yet indexed.' } }, 404),
    );

    try {
      await apiGet('/v1/reputation/0xdead');
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const apiErr = err as { status: number; code: string; message: string };
      expect(apiErr.status).toBe(404);
      expect(apiErr.code).toBe('unknown_address');
      expect(apiErr.message).toBe('Address not yet indexed.');
    }
  });

  it('handles JSON parse failure on error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('parse error')),
    });

    try {
      await apiGet('/v1/stats');
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const apiErr = err as { status: number; code: string; message: string };
      expect(apiErr.status).toBe(500);
      expect(apiErr.message).toBe('API error: 500');
    }
  });
});

describe('apiPost', () => {
  it('makes a POST request with JSON body and Bearer auth', async () => {
    const mockData = { decision: 'allow', on_the_fly: true };
    mockFetch.mockResolvedValueOnce(mockResponse(mockData));

    const result = await apiPost('/v1/assess', { address: '0xabc', chain: 'base' });

    expect(result).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test.agentscore.sh/v1/assess');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Authorization']).toBe('Bearer ask_test_key_123');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(opts.body)).toEqual({ address: '0xabc', chain: 'base' });
  });

  it('throws ApiError on 402 payment required', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: { code: 'payment_required', message: 'Paid plan required' } }, 402),
    );

    try {
      await apiPost('/v1/assess', { address: '0xabc' });
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const apiErr = err as { status: number; code: string; message: string };
      expect(apiErr.status).toBe(402);
      expect(apiErr.code).toBe('payment_required');
    }
  });
});
