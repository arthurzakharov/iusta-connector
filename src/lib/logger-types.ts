type Fn = {
  (obj: object, msg?: string): void;
  (msg: string): void;
};

type Levels =
  "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

export type Logger = Record<Levels, Fn>;
