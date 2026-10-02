import pino from "pino";

type LogEntry = Record<string, unknown> & { level: number; msg: string };

/** Logger that keeps emitted entries in memory so tests can assert on them. */
export function createTestLogger(): {
  logger: pino.Logger;
  entries: LogEntry[];
} {
  const entries: LogEntry[] = [];
  const logger = pino(
    { level: "trace" },
    { write: (line: string) => entries.push(JSON.parse(line)) },
  );
  return { logger, entries };
}
