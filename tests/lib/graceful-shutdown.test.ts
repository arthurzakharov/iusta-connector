import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { handleShutdownSignals } from "@/lib/graceful-shutdown";
import { createTestLogger } from "@tests/helpers/logger";

const exitSpy = spyOn(process, "exit").mockImplementation(
  (() => undefined) as never,
);

afterEach(() => {
  exitSpy.mockClear();
  process.removeAllListeners("SIGINT");
  process.removeAllListeners("SIGTERM");
});

describe("handleShutdownSignals", () => {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    test(`logs, stops the server and exits cleanly on ${signal}`, async () => {
      const { logger, entries } = createTestLogger();
      const stop = mock(() => Promise.resolve());
      handleShutdownSignals(logger, { stop });

      process.emit(signal);
      await Bun.sleep(0);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ msg: "shutting down", signal });
      expect(stop).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  }

  test("handles each signal only once", async () => {
    const { logger } = createTestLogger();
    const stop = mock(() => Promise.resolve());
    handleShutdownSignals(logger, { stop });

    process.emit("SIGTERM");
    await Bun.sleep(0);

    expect(process.listenerCount("SIGTERM")).toBe(0);
    expect(process.listenerCount("SIGINT")).toBe(1);
  });
});
