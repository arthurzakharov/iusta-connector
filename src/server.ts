import { createApp } from "@/app";
import { parseEnv } from "@/config/env";
import { resolveCommitInfo } from "@/lib/commit-info";
import { createLogger } from "@/lib/logger";

const env = parseEnv(process.env);
const logger = createLogger({
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === "development",
});

const commitInfo = await resolveCommitInfo(process.env, { logger });

if (!commitInfo) {
  logger.warn(
    { renderCommit: process.env.RENDER_GIT_COMMIT },
    "commit info unavailable: set GIT_COMMIT_* env vars, run inside a git repository, or check GitHub API access",
  );
}

const app = createApp({
  logger,
  commitInfo,
  allowedOrigins: env.ALLOWED_ORIGINS,
});
const server = Bun.serve({ port: env.PORT, fetch: app.fetch });

logger.info(
  { port: server.port, env: env.NODE_ENV, commit: commitInfo?.shortHash },
  "server started",
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    logger.info({ signal }, "shutting down");
    await server.stop();
    process.exit(0);
  });
}
