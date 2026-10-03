import { describe, expect, test } from "bun:test";
import { createApp } from "@/app";
import { createIustaClient } from "@/client";
import { commitInfoFixture } from "@tests/helpers/fixtures";
import { createTestLogger } from "@tests/helpers/logger";

describe("createIustaClient", () => {
  test("calls the API with typed routes", async () => {
    const { logger } = createTestLogger();
    const app = createApp({ logger, commitInfo: commitInfoFixture });
    const client = createIustaClient("http://connector.test", {
      fetch: (input: string | URL | Request, init?: RequestInit) =>
        app.request(input, init),
    });

    const res = await client.health.$get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      status: "ok",
      commit: {
        shortHash: commitInfoFixture.shortHash,
        date: commitInfoFixture.date,
      },
    });
  });
});
