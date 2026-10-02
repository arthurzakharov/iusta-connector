/**
 * Minimal logger contract used across the app.
 * Kept free of pino imports so the published client types don't depend on pino.
 */
type Fn = {
  (obj: object, msg?: string): void;
  (msg: string): void;
};

type Levels =
  "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

export type Logger = Record<Levels, Fn>
