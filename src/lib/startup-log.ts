import type { Env } from "@/config/env";
import type { CommitInfo } from "@/lib/commit-info";
import type { Logger } from "@/lib/logger-types";

interface Params {
  env: Env;
  commitInfo: CommitInfo | null;
}

/**
 * Log the start of server, providing actual information and warn in case
 * commit information is not available. Missing commit information will cause
 * incomplete response to GET /health endpoint.
 */
export function logServerStart(logger: Logger, params: Params) {
  logger.info(
    {
      port: params.env.PORT,
      env: params.env.NODE_ENV,
      commit: params.commitInfo?.shortHash ?? null,
      allowedOrigins: params.env.ALLOWED_ORIGINS,
    },
    "server started",
  );
  if (!params.commitInfo) {
    logger.warn(
      "commit info unavailable: check that a git repository token is provided",
    );
  }
}
