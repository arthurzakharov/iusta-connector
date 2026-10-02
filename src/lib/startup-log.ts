import type { Env } from "@/config/env";
import type { CommitInfo } from "@/types/responses";
import type { Logger } from "@/lib/logger-types";

type LogServerStartParams = {
  env: Env;
  commitInfo: CommitInfo | null;
};

export function logServerStart(
  logger: Logger,
  { env, commitInfo }: LogServerStartParams,
): void {
  logger.info(
    {
      port: env.PORT,
      env: env.NODE_ENV,
      commit: commitInfo?.shortHash ?? null,
      allowedOrigins: env.ALLOWED_ORIGINS,
    },
    "server started",
  );
  if (!commitInfo) {
    logger.warn(
      "commit info unavailable: pass GIT_COMMIT_* build args or run inside a git repository",
    );
  }
}
