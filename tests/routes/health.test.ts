import { describe, expect, test } from "bun:test";
import { testClient } from "hono/testing";
import { createApp } from "@/app";
import { commitInfoFixture } from "@tests/helpers/fixtures";
import { createTestLogger } from "@tests/helpers/logger";

describe("health routes", () => {
  for (const path of ["/health", "/"]) {
    test(`GET ${path} returns ok status with commit info`, async () => {
      const { logger } = createTestLogger();
      const app = createApp({ logger, commitInfo: commitInfoFixture });

      const res = await app.request(path);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: "ok",
        commit: commitInfoFixture,
      });
    });
  }

  test("returns null commit when commit info is unavailable", async () => {
    const { logger } = createTestLogger();
    const app = createApp({ logger, commitInfo: null });

    const res = await app.request("/health");

    expect(await res.json()).toEqual({ status: "ok", commit: null });
  });

  test("is callable through the typed RPC client", async () => {
    const { logger } = createTestLogger();
    const client = testClient(
      createApp({ logger, commitInfo: commitInfoFixture }),
    );

    const res = await client.health.$get();
    const body = await res.json();

    expect(body.status).toBe("ok");
    expect(body.commit?.shortHash).toBe(commitInfoFixture.shortHash);
  });
});
