import { describe, expect, test } from 'bun:test'
import { buildLoggerOptions, createLogger } from '../../src/lib/logger'

describe('logger', () => {
  test('uses JSON output without a transport when pretty is disabled', () => {
    const options = buildLoggerOptions({ level: 'info', pretty: false })
    expect(options.level).toBe('info')
    expect(options.transport).toBeUndefined()
  })

  test('uses pino-pretty transport when pretty is enabled', () => {
    const options = buildLoggerOptions({ level: 'debug', pretty: true })
    expect(options.transport).toMatchObject({ target: 'pino-pretty' })
  })

  test('creates a logger with the requested level', () => {
    const logger = createLogger({ level: 'warn', pretty: false })
    expect(logger.level).toBe('warn')
  })
})
