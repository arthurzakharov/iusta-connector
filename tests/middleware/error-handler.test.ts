import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { requestId } from "hono/request-id";
import {
  HttpError,
  HttpNetworkError,
  HttpTimeoutError,
  UnexpectedResponseError,
} from "@/api/http-client";
import { errorHandler } from "@/middleware/error-handler";
import { ValidationError } from "@/middleware/validate";
import { createTestLogger } from "@tests/helpers/logger";

function setup(error: Error) {
  const { logger, entries } = createTestLogger();
  const app = new Hono()
    .use(requestId())
    .get("/fail", () => {
      throw error;
    })
    .onError(errorHandler(logger));
  const request = async (): Promise<Response> =>
    app.request("/fail", { headers: { "X-Request-Id": "req-1" } });
  return { request, entries };
}

describe("errorHandler", () => {
  test("answers validation errors with 400 and the issues, without logging", async () => {
    const issues = [{ path: "json.name", message: "Required" }];
    const { request, entries } = setup(new ValidationError(issues));

    const res = await request();

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Bad Request",
      requestId: "req-1",
      issues,
    });
    expect(entries).toHaveLength(0);
  });

  test("answers upstream timeouts with 504", async () => {
    const { request, entries } = setup(
      new HttpTimeoutError(new DOMException("timed out", "TimeoutError")),
    );

    const res = await request();

    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({
      error: "Gateway Timeout",
      requestId: "req-1",
    });
    expect(entries[0]).toMatchObject({
      level: 40,
      msg: "upstream request timed out",
      requestId: "req-1",
    });
  });

  for (const error of [
    new HttpError(503, new Headers(), "maintenance"),
    new HttpNetworkError(new Error("connection refused")),
    new UnexpectedResponseError(new Error("bad shape")),
  ]) {
    test(`answers ${error.name} with 502 and logs the upstream details`, async () => {
      const { request, entries } = setup(error);

      const res = await request();

      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({
        error: "Bad Gateway",
        requestId: "req-1",
      });
      expect(entries[0]).toMatchObject({
        level: 40,
        msg: "upstream request failed",
        requestId: "req-1",
        err: { type: error.name },
      });
    });
  }

  test("logs the upstream status and body of HttpError", async () => {
    const { request, entries } = setup(
      new HttpError(503, new Headers(), '{"message":"maintenance"}'),
    );

    await request();

    expect(entries[0]?.err).toMatchObject({
      status: 503,
      body: '{"message":"maintenance"}',
    });
  });

  test("answers other errors with 500", async () => {
    const { request, entries } = setup(new Error("kaboom"));

    const res = await request();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Internal Server Error",
      requestId: "req-1",
    });
    expect(entries[0]).toMatchObject({
      level: 50,
      msg: "unhandled error",
      err: { message: "kaboom" },
    });
  });
});
