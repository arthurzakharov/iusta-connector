import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import type { RequestIdVariables } from "hono/request-id";
import type { Logger } from "@/lib/logger-types";

export function requestLogger(
  logger: Logger,
): MiddlewareHandler<{ Variables: RequestIdVariables }> {
  return createMiddleware<{ Variables: RequestIdVariables }>(
    async (c, next) => {
      const start = performance.now();
      await next();

      const status = c.res.status;
      const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      logger[level](
        {
          requestId: c.get("requestId"),
          method: c.req.method,
          path: c.req.path,
          status,
          durationMs: Math.round((performance.now() - start) * 100) / 100,
        },
        "request completed",
      );
    },
  );
}
