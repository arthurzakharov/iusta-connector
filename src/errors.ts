import type { ValidationIssue } from "@/types/responses";

export class AppError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  public constructor(public readonly issues: ValidationIssue[]) {
    super("request validation failed");
  }
}

export class HttpClientError extends AppError {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class HttpError extends HttpClientError {
  readonly #headers: Headers;
  readonly #body: string;

  public constructor(
    public readonly status: number,
    headers: Headers,
    body: string,
    public readonly passthrough: boolean = false,
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
