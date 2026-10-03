import type { Logger } from "@/types/logger";

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

type Schema<T> = { parse(data: unknown): T };

type QueryValue = string | number | boolean | undefined;

type RequestContext = {
  logger: Logger;
  requestId: string;
};

type HttpClientConstructor = {
  baseUrl: string;
  logger: Logger;
  headers?: Record<string, string>;
  timeoutMs?: number;
  fetch?: FetchFn;
};

type RequestParams = {
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
};

type SendParams = RequestParams & {
  method: string;
  body?: unknown;
};

export class HttpClientError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class HttpError extends HttpClientError {
  readonly #headers: Headers;
  readonly #body: string;

  public constructor(
    public readonly status: number,
    headers: Headers,
    body: string,
  ) {
    super(`request failed with status ${status}`);
    this.#headers = headers;
    this.#body = body;
  }

  public get headers(): Headers {
    return this.#headers;
  }

  public get body(): string {
    return this.#body;
  }
}

export class UnexpectedResponseError extends HttpClientError {
  public constructor(cause: unknown) {
    super("response body does not match the expected schema", { cause });
  }
}

export class HttpTimeoutError extends HttpClientError {
  public constructor(cause: unknown) {
    super("request timed out", { cause });
  }
}

export class HttpNetworkError extends HttpClientError {
  public constructor(cause: unknown) {
    super("request failed before a complete response was received", {
      cause,
    });
  }
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly logger: Logger;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly fetchFn: FetchFn;

  public constructor({
    baseUrl,
    logger,
    headers = {},
    timeoutMs = 5000,
    fetch = globalThis.fetch,
  }: HttpClientConstructor) {
    this.baseUrl = baseUrl;
    this.logger = logger;
    this.headers = headers;
    this.timeoutMs = timeoutMs;
    this.fetchFn = fetch;
  }

  public forRequest({ logger, requestId }: RequestContext): HttpClient {
    return new HttpClient({
      baseUrl: this.baseUrl,
      logger,
      headers: { ...this.headers, "X-Request-Id": requestId },
      timeoutMs: this.timeoutMs,
      fetch: this.fetchFn,
    });
  }

  public get<T>(
    path: string,
    schema: Schema<T>,
    options?: RequestParams,
  ): Promise<T> {
    return this.send(path, schema, { ...options, method: "GET" });
  }

  public post<T>(
    path: string,
    body: unknown,
    schema: Schema<T>,
    options?: RequestParams,
  ): Promise<T> {
    return this.send(path, schema, { ...options, method: "POST", body });
  }

  public put<T>(
    path: string,
    body: unknown,
    schema: Schema<T>,
    options?: RequestParams,
  ): Promise<T> {
    return this.send(path, schema, { ...options, method: "PUT", body });
  }

  public patch<T>(
    path: string,
    body: unknown,
    schema: Schema<T>,
    options?: RequestParams,
  ): Promise<T> {
    return this.send(path, schema, { ...options, method: "PATCH", body });
  }

  public delete<T>(
    path: string,
    schema: Schema<T>,
    options?: RequestParams,
  ): Promise<T> {
    return this.send(path, schema, { ...options, method: "DELETE" });
  }

  private async send<T>(
    path: string,
    schema: Schema<T>,
    { method, body, query, headers }: SendParams,
  ): Promise<T> {
    const url = this.buildUrl(path, query);
    const hasBody = body !== undefined;
    const start = performance.now();
    const fetch = this.fetchFn;

    let res: Response;
    let text: string;
    try {
      res = await fetch(url, {
        method,
        headers: {
          ...this.headers,
          ...(hasBody && { "Content-Type": "application/json" }),
          ...headers,
        },
        ...(hasBody && { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      text = await res.text();
    } catch (err) {
      this.logger.warn(
        { method, url: this.logUrl(url), durationMs: this.since(start), err },
        "outgoing request failed",
      );
      throw isTimeout(err)
        ? new HttpTimeoutError(err)
        : new HttpNetworkError(err);
    }

    const log = {
      method,
      url: this.logUrl(url),
      status: res.status,
      durationMs: this.since(start),
    };

    if (!res.ok) {
      this.logger.warn(log, "outgoing request completed");
      throw new HttpError(res.status, res.headers, text);
    }
    this.logger.info(log, "outgoing request completed");

    try {
      return schema.parse(text === "" ? undefined : JSON.parse(text));
    } catch (err) {
      throw new UnexpectedResponseError(err);
    }
  }

  private buildUrl(
    path: string,
    query: Record<string, QueryValue> = {},
  ): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) search.append(key, String(value));
    }
    const qs = search.toString();
    const url = `${this.baseUrl}${path}`;
    if (!qs) return url;
    return `${url}${url.includes("?") ? "&" : "?"}${qs}`;
  }

  private logUrl(url: string): string {
    const { origin, pathname } = new URL(url);
    return `${origin}${pathname}`;
  }

  private since(start: number): number {
    return Math.round((performance.now() - start) * 100) / 100;
  }
}

function isTimeout(err: unknown): boolean {
  return err instanceof DOMException && err.name === "TimeoutError";
}
