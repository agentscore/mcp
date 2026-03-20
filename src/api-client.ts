const baseUrl = (process.env.AGENTSCORE_BASE_URL ?? 'https://api.agentscore.sh').replace(/\/+$/, '');
const apiKey = process.env.AGENTSCORE_API_KEY;

if (!apiKey) {
  console.error('AGENTSCORE_API_KEY is required. Get one at https://agentscore.sh/sign-up');
  process.exit(1);
}

const defaultHeaders: Record<string, string> = {
  Accept: 'application/json',
  Authorization: `Bearer ${apiKey}`,
};

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export async function apiGet(path: string, params?: Record<string, string>): Promise<unknown> {
  const url = new URL(path, baseUrl);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: defaultHeaders,
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = (body as Record<string, Record<string, string>>)?.error;
    const apiErr: ApiError = {
      status: res.status,
      code: error?.code ?? 'unknown_error',
      message: error?.message ?? `API error: ${res.status}`,
    };
    throw apiErr;
  }

  return res.json();
}

export async function apiPost(path: string, body: unknown): Promise<unknown> {
  const url = new URL(path, baseUrl);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const respBody = await res.json().catch(() => ({}));
    const error = (respBody as Record<string, Record<string, string>>)?.error;
    const apiErr: ApiError = {
      status: res.status,
      code: error?.code ?? 'unknown_error',
      message: error?.message ?? `API error: ${res.status}`,
    };
    throw apiErr;
  }

  return res.json();
}
