import { Hono } from 'hono'
import type { CommitInfo } from '@/lib/commit-info'

export type HealthResponse = {
  status: 'ok'
  commit: CommitInfo | null
}

export function createHealthRoutes(commitInfo: CommitInfo | null) {
  const body: HealthResponse = { status: 'ok', commit: commitInfo }

  return new Hono()
    .get('/', (c) => c.json(body))
    .get('/health', (c) => c.json(body))
}
