import pino, { type LevelWithSilent } from "pino";

type LoggerParams = {
  level: LevelWithSilent;
  pretty: boolean;
};

export function buildLoggerOptions({
  level,
  pretty,
}: LoggerParams): pino.LoggerOptions {
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

export function createLogger(params: LoggerParams): pino.Logger {
  return pino(buildLoggerOptions(params));
}
