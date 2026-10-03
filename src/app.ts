import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import type { CommitInfo } from "@/lib/commit-info";
import type { ErrorResponse } from "@/types/responses";
import type { Logger } from "@/lib/logger-types";
import { errorHandler } from "@/middleware/error-handler";
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
  app.use(secureHeaders());
  app.use(cors({ origin: allowedOrigins, exposeHeaders: ["X-Request-Id"] }));
  app.use(requestLogger(logger));

  app.notFound((c) =>
    c.json<ErrorResponse>(
      { error: "Not Found", requestId: c.get("requestId") },
      404,
    ),
  );
  app.onError(errorHandler(logger));

  return app.route("/", createHealthRoutes(commitInfo));
}

export type AppType = ReturnType<typeof createApp>;
export type {
  ErrorResponse,
  HealthResponse,
  PublicCommitInfo,
  ValidationIssue,
} from "@/types/responses";
