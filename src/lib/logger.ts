import pino, { type LevelWithSilent, type LoggerOptions } from 'pino'

export type Logger = pino.Logger

export type LoggerConfig = {
  level: LevelWithSilent
  pretty: boolean
}

export function buildLoggerOptions({ level, pretty }: LoggerConfig): LoggerOptions {
  return {
    level,
    base: { service: 'iusta-connector' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    ...(pretty && { transport: { target: 'pino-pretty', options: { colorize: true } } }),
  }
}

export function createLogger(config: LoggerConfig): Logger {
  return pino(buildLoggerOptions(config))
}
