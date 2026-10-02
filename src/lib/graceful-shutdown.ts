import type { Logger } from "@/lib/logger-types";

type StoppableServer = {
  stop(closeActiveConnections?: boolean): Promise<void>;
};

const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"] as const;

/** Below the usual platform grace period (e.g. 10s for `docker stop`) before a hard kill. */
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Stops accepting new connections, lets in-flight requests finish, then exits.
 * Connections still open after `timeoutMs` are closed, so a hanging request cannot block a deploy.
 */
export function handleShutdownSignals(
  logger: Logger,
  server: StoppableServer,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): void {
  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, async () => {
      logger.info({ signal }, "shutting down");
      await stopServer(logger, server, timeoutMs);
      process.exit(0);
    });
  }
}

async function stopServer(
  logger: Logger,
  server: StoppableServer,
  timeoutMs: number,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const forceStop = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      logger.warn(
        { timeoutMs },
        "requests still running after shutdown timeout, closing connections",
      );
      resolve(server.stop(true));
    }, timeoutMs);
  });

  await Promise.race([server.stop(), forceStop]);
  clearTimeout(timer);
}
