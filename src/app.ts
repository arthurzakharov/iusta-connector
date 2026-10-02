import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import type { CommitInfo } from "@/types/responses";
import type { Logger } from "@/lib/logger-types";
import { requestLogger } from "@/middleware/request-logger";
import { createHealthRoutes } from "@/routes/health";

type CreateAppParams = {
  logger: Logger;
  commitInfo: CommitInfo | null;
  allowedOrigins?: string[];
};

export function createApp({
  logger,
  commitInfo,
  allowedOrigins = [],
}: CreateAppParams) {
  const app = new Hono();

  app.use(requestId());
  app.use(cors({ origin: allowedOrigins, exposeHeaders: ["X-Request-Id"] }));
  app.use(requestLogger(logger));

  app.notFound((c) => c.json({ error: "Not Found" }, 404));
  app.onError((err, c) => {
    logger.error({ err, requestId: c.get("requestId") }, "unhandled error");
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app.route("/", createHealthRoutes(commitInfo));
}

export type AppType = ReturnType<typeof createApp>;
export type { CommitInfo, HealthResponse } from "@/types/responses";
