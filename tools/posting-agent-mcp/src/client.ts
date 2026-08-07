/**
 * Thin HTTP client for the coaching app's admin API.
 *
 * Authenticates with a service API key (see `npm run api:key -- create`), which
 * the API resolves to a real admin user, so this client has exactly the
 * permissions of that account and nothing more.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    readonly path: string,
  ) {
    super(`${path} → ${status}: ${body.slice(0, 600)}`);
    this.name = 'ApiError';
  }
}

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

export function loadConfig(): ApiConfig {
  const baseUrl = (process.env.COACHING_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
  const apiKey = process.env.COACHING_API_KEY ?? '';
  // The setup snippets ship a placeholder. Left unreplaced it is a non-empty
  // string, so without this check every call would fail as a bare 401 that
  // looks like a broken key rather than an unfinished setup.
  if (!apiKey || apiKey.startsWith('PASTE_') || apiKey === 'wtia_...') {
    throw new Error(
      'COACHING_API_KEY is not set (still the placeholder). Mint a key with:\n' +
        '  npm run api:key -- create <admin-email> "claude desktop"\n' +
        'then paste it into claude_desktop_config.json and restart Claude Desktop.',
    );
  }
  if (!apiKey.startsWith('wtia_')) {
    throw new Error(
      'COACHING_API_KEY does not look like a service key (expected it to start with "wtia_"). ' +
        'Use a key from `npm run api:key -- create`, not a login password or a user token.',
    );
  }
  const timeoutMs = Number(process.env.COACHING_API_TIMEOUT_MS ?? 180_000);
  return { baseUrl, apiKey, timeoutMs };
}

export class CoachingApi {
  constructor(private readonly config: ApiConfig) {}

  private async request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    // AI parse calls routinely run past a minute on long documents; the default
    // fetch timeout would abort a request the server is still happily working on.
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: {
          'X-Api-Key': this.config.apiKey,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await response.text();
      if (!response.ok) throw new ApiError(response.status, text, path);
      return (text ? JSON.parse(text) : null) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const query = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== '')
            .map(([k, v]) => [k, String(v)]),
        ).toString()
      : '';
    return this.request<T>('GET', `${path}${query}`);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  /** Partial update — only the supplied fields change. Used for corrections. */
  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }
}
