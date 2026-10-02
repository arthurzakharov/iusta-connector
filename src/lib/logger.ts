import pino, { type LevelWithSilent } from "pino";

interface LoggerConfig {
  level: LevelWithSilent;
  pretty: boolean;
}

/**
 * Create configuration for pino logger
 */
export function buildLoggerOptions({ level, pretty }: LoggerConfig): pino.LoggerOptions {
  return {
    level,
    base: { service: "iusta-connector" },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: ["req.headers.authorization", "req.headers.cookie"],
    ...(pretty && {
      transport: { target: "pino-pretty", options: { colorize: true } },
    }),
  };
}

/**
 * Create instance of pino logger.
 */
export function createLogger(config: LoggerConfig): pino.Logger {
  return pino(buildLoggerOptions(config));
}
