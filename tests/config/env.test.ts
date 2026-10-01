import { describe, expect, test } from 'bun:test'
import { parseEnv } from '../../src/config/env'

describe('parseEnv', () => {
  test('applies defaults', () => {
    expect(parseEnv({})).toEqual({ NODE_ENV: 'development', PORT: 3000, LOG_LEVEL: 'info' })
  })

  test('parses provided values', () => {
    expect(parseEnv({ NODE_ENV: 'production', PORT: '8080', LOG_LEVEL: 'warn' })).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
      LOG_LEVEL: 'warn',
    })
  })

  test('throws a readable error for invalid values', () => {
    expect(() => parseEnv({ PORT: 'abc', LOG_LEVEL: 'loud' })).toThrow(/Invalid environment variables[\s\S]*PORT[\s\S]*LOG_LEVEL/)
  })
})
