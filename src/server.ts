import { createApp } from "@/app";
import { parseEnv } from "@/config/env";
import { resolveCommitInfo } from "@/lib/commit-info";
import { handleShutdownSignals } from "@/lib/graceful-shutdown";
import { createLogger } from "@/lib/logger";
import { logServerStart } from "@/lib/startup-log";

const env = parseEnv(process.env);

const logger = createLogger({
  level: env.LOG_LEVEL,
  pretty: env.LOG_FORMAT === "pretty",
});

const commitInfo = await resolveCommitInfo(env, { logger });

const app = createApp({
  logger,
  commitInfo,
  allowedOrigins: env.ALLOWED_ORIGINS,
});

const server = Bun.serve({ port: env.PORT, fetch: app.fetch });

logServerStart(logger, { env, commitInfo });

handleShutdownSignals(logger, server);
