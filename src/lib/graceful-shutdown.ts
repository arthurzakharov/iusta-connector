import type { Logger } from "@/lib/logger-types";

type StoppableServer = { stop(): Promise<void> };

const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"] as const;

/**
 * Stops accepting new connections, lets in-flight requests finish, then exits.
 */
export function handleShutdownSignals(
  logger: Logger,
  server: StoppableServer,
): void {
  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, async () => {
      logger.info({ signal }, "shutting down");
      await server.stop();
      process.exit(0);
    });
  }
}
