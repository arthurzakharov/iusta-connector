/**
 * Minimal logger contract used across the app.
 * Kept free of pino imports so the published client types don't depend on pino.
 */
export type LogFn = {
  (obj: object, msg?: string): void;
  (msg: string): void;
};

export type Logger = {
  fatal: LogFn;
  error: LogFn;
  warn: LogFn;
  info: LogFn;
  debug: LogFn;
  trace: LogFn;
};
