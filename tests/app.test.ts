import { describe, expect, test } from "bun:test";
import { createApp } from "@/app";
import { createTestLogger } from "@tests/helpers/logger";

describe("app", () => {
  test("returns JSON 404 for unknown routes", async () => {
    const { logger } = createTestLogger();
    const app = createApp({ logger, commitInfo: null });

    const res = await app.request("/does-not-exist");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not Found" });
  });

  test("returns JSON 500 and logs unhandled errors", async () => {
    const { logger, entries } = createTestLogger();
    const app = createApp({ logger, commitInfo: null });
    app.get("/boom", () => {
      throw new Error("kaboom");
    });

    const res = await app.request("/boom");

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal Server Error" });
    const errorLog = entries.find((e) => e.msg === "unhandled error");
    expect(errorLog).toMatchObject({ err: { message: "kaboom" } });
    expect(errorLog?.requestId).toBeString();
  });

  test("sets an X-Request-Id header and honours an incoming one", async () => {
    const { logger } = createTestLogger();
    const app = createApp({ logger, commitInfo: null });

    const generated = await app.request("/health");
    const forwarded = await app.request("/health", {
      headers: { "X-Request-Id": "abc-123" },
    });

    expect(generated.headers.get("X-Request-Id")).toBeString();
    expect(forwarded.headers.get("X-Request-Id")).toBe("abc-123");
  });
});

describe("CORS", () => {
  const origin = "https://app.example.com";

  test("allows configured origins and exposes X-Request-Id", async () => {
    const { logger } = createTestLogger();
    const app = createApp({
      logger,
      commitInfo: null,
      allowedOrigins: [origin],
    });

    const res = await app.request("/health", { headers: { Origin: origin } });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(res.headers.get("Access-Control-Expose-Headers")).toBe(
      "X-Request-Id",
    );
  });

  test("answers preflight requests for configured origins", async () => {
    const { logger } = createTestLogger();
    const app = createApp({
      logger,
      commitInfo: null,
      allowedOrigins: [origin],
    });

    const res = await app.request("/health", {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "PATCH" },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  });

  test("does not allow unknown origins", async () => {
    const { logger } = createTestLogger();
    const app = createApp({
      logger,
      commitInfo: null,
      allowedOrigins: [origin],
    });

    const res = await app.request("/health", {
      headers: { Origin: "https://evil.example.com" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
