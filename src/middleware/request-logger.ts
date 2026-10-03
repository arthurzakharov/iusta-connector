import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "@/types/app-env";
import type { Logger } from "@/types/logger";

export function requestLogger(logger: Logger): MiddlewareHandler<AppEnv> {
  return createMiddleware<AppEnv>(async (c, next) => {
    const start = performance.now();
    const requestLogger = logger.child({ requestId: c.get("requestId") });
    c.set("logger", requestLogger);

    await next();

    const status = c.res.status;
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    requestLogger[level](
      {
        method: c.req.method,
        path: c.req.path,
        status,
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      },
      "request completed",
    );
  });
}
