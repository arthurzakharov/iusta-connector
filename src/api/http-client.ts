export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Anything with a zod-like parse; keeps this module free of a validation library dependency.
 */
type Schema<T> = { parse(data: unknown): T };

type HttpClientConstructor = {
  baseUrl: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  fetch?: FetchFn;
};

type RequestParams = {
  method: string;
  body?: string;
  headers?: Record<string, string>;
};

/**
 * Thrown for non-2xx responses.
 */
export class HttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly headers: Headers,
  ) {
    super(`request failed with status ${status}`);
    this.name = "HttpError";
  }
}

/**
 * Thrown when a response body does not match the expected schema.
 */
export class UnexpectedResponseError extends Error {
  public constructor(cause: unknown) {
    super("response body does not match the expected schema", { cause });
    this.name = "UnexpectedResponseError";
  }
}

/**
 * Preconfigured HTTP client for one API: base URL, default
 * headers and timeout are shared by every request.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly fetchFn: FetchFn;

  public constructor({
    baseUrl,
    headers = {},
    timeoutMs = 5000,
    fetch = globalThis.fetch,
  }: HttpClientConstructor) {
    this.baseUrl = baseUrl;
    this.headers = headers;
    this.timeoutMs = timeoutMs;
    this.fetchFn = fetch;
  }

  public get<T>(path: string, schema: Schema<T>): Promise<T> {
    return this.request(path, schema, { method: "GET" });
  }

  public post<T>(path: string, body: unknown, schema: Schema<T>): Promise<T> {
    return this.request(path, schema, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  private async request<T>(
    path: string,
    schema: Schema<T>,
    { headers, ...init }: RequestParams,
  ): Promise<T> {
    const fetch = this.fetchFn;
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers, ...headers },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new HttpError(res.status, res.headers);

    try {
      return schema.parse(await res.json());
    } catch (err) {
      throw new UnexpectedResponseError(err);
    }
  }
}
