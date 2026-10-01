import { createApp } from './app'
import { parseEnv } from './config/env'
import { resolveCommitInfo } from './lib/commit-info'
import { createLogger } from './lib/logger'

const env = parseEnv(process.env)
const logger = createLogger({ level: env.LOG_LEVEL, pretty: env.NODE_ENV === 'development' })

const commitInfo = resolveCommitInfo(process.env)
if (!commitInfo) {
  logger.warn('commit info unavailable: set GIT_COMMIT_* env vars or run inside a git repository')
}

const app = createApp({ logger, commitInfo })
const server = Bun.serve({ port: env.PORT, fetch: app.fetch })

logger.info({ port: server.port, env: env.NODE_ENV, commit: commitInfo?.shortHash }, 'server started')

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    logger.info({ signal }, 'shutting down')
    await server.stop()
    process.exit(0)
  })
}
