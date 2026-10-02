import type { Env } from "@/config/env";
import type { CommitInfo } from "@/lib/commit-info";
import type { Logger } from "@/lib/logger-types";

type Params = {
  env: Env;
  commitInfo: CommitInfo | null;
};

/**
 * Log the start of server, providing actual information and warn in case
 * commit information is not available. Missing commit information will cause
 * incomplete response to GET /health endpoint.
 */
export function logServerStart(logger: Logger, params: Params): void {
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
      "commit info unavailable: pass GIT_COMMIT_* build args, run inside a git repository, or check GIT_REPOSITORY_NAME and GIT_REPOSITORY_TOKEN",
    );
  }
}
