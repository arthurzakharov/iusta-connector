import type { Logger } from "@/types/logger";

type StoppableServer = {
  stop(closeActiveConnections?: boolean): Promise<void>;
};

const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"] as const;

const DEFAULT_TIMEOUT_MS = 5000;

export function handleShutdownSignals(
  logger: Logger,
  server: StoppableServer,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): void {
  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, async () => {
      logger.info({ signal }, "shutting down");
      try {
        await stopServer(logger, server, timeoutMs);
      } catch (err) {
        logger.error({ err }, "server did not stop cleanly");
        process.exit(1);
        return;
      }
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
