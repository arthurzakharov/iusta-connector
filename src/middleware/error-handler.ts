import type { ErrorHandler } from "hono";
import { HttpClientError, HttpTimeoutError } from "@/api/http-client";
import type { Logger } from "@/types/logger";
import { ValidationError } from "@/middleware/validate";
import type { ErrorResponse } from "@/types/responses";

export function errorHandler(logger: Logger): ErrorHandler {
  return (err, c) => {
    const requestId = c.get("requestId");

    if (err instanceof ValidationError) {
      return c.json<ErrorResponse>(
        { error: "Bad Request", requestId, issues: err.issues },
        400,
      );
    }
    if (err instanceof HttpTimeoutError) {
      logger.warn({ err, requestId }, "upstream request timed out");
      return c.json<ErrorResponse>(
        { error: "Gateway Timeout", requestId },
        504,
      );
    }
    if (err instanceof HttpClientError) {
      logger.warn({ err, requestId }, "upstream request failed");
      return c.json<ErrorResponse>({ error: "Bad Gateway", requestId }, 502);
    }

    logger.error({ err, requestId }, "unhandled error");
    return c.json<ErrorResponse>(
      { error: "Internal Server Error", requestId },
      500,
    );
  };
}
