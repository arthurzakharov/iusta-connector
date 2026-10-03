import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { HttpClient } from "@/api/http-client";
import {
  HttpClientError,
  HttpError,
  HttpNetworkError,
  HttpTimeoutError,
  UnexpectedResponseError,
} from "@/errors";
import { createTestLogger } from "@tests/helpers/logger";

const itemSchema = z.object({ id: z.number() });

type FetchCall = { url: string; init?: RequestInit | undefined };

function setup(response: () => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  const { logger, entries } = createTestLogger();
  const http = new HttpClient({
    baseUrl: "https://api.example.com",
    logger,
    headers: { Authorization: "Bearer secret" },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return response();
    },
  });
  const headers = (i = 0): Headers => new Headers(calls[i]?.init?.headers);
  return { http, calls, entries, headers };
}

describe("HttpClient", () => {
  test("GET joins the base URL, sends default headers and parses the body", async () => {
    const { http, calls, headers } = setup(() => Response.json({ id: 1 }));

    expect(await http.get("/items/1", itemSchema)).toEqual({ id: 1 });
    expect(calls[0]?.url).toBe("https://api.example.com/items/1");
    expect(calls[0]?.init?.method).toBe("GET");
    expect(calls[0]?.init?.body).toBeUndefined();
    expect(headers().get("Authorization")).toBe("Bearer secret");
    expect(headers().has("Content-Type")).toBe(false);
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  for (const method of ["post", "put", "patch"] as const) {
    test(`${method.toUpperCase()} sends a JSON body alongside the default headers`, async () => {
      const { http, calls, headers } = setup(() => Response.json({ id: 2 }));

      expect(await http[method]("/items", { name: "new" }, itemSchema)).toEqual(
        { id: 2 },
      );
      expect(calls[0]?.init?.method).toBe(method.toUpperCase());
      expect(calls[0]?.init?.body).toBe('{"name":"new"}');
      expect(headers().get("Content-Type")).toBe("application/json");
      expect(headers().get("Authorization")).toBe("Bearer secret");
    });
  }

  test("DELETE sends no body", async () => {
    const { http, calls } = setup(() => new Response(null, { status: 204 }));

    await http.delete("/items/1", z.undefined());

    expect(calls[0]?.init?.method).toBe("DELETE");
    expect(calls[0]?.init?.body).toBeUndefined();
  });

  test("passes an empty body to the schema as undefined", async () => {
    const { http } = setup(() => new Response(null, { status: 204 }));

    expect(await http.post("/items/1/archive", {}, z.undefined())).toBe(
      undefined,
    );
  });

  test("appends query parameters and skips undefined values", async () => {
    const { http, calls } = setup(() => Response.json({ id: 1 }));

    await http.get("/items", itemSchema, {
      query: { page: 2, active: true, q: "a b&c", missing: undefined },
    });
    await http.get("/items?sort=name", itemSchema, { query: { page: 1 } });

    expect(calls[0]?.url).toBe(
      "https://api.example.com/items?page=2&active=true&q=a+b%26c",
    );
    expect(calls[1]?.url).toBe(
      "https://api.example.com/items?sort=name&page=1",
    );
  });

  test("merges per-request headers over the defaults", async () => {
    const { http, headers } = setup(() => Response.json({ id: 1 }));

    await http.post("/items", {}, itemSchema, {
      headers: { "Idempotency-Key": "k-1", Authorization: "Bearer other" },
    });

    expect(headers().get("Idempotency-Key")).toBe("k-1");
    expect(headers().get("Authorization")).toBe("Bearer other");
  });

  test("throws HttpError with status, headers and the response body for non-2xx responses", async () => {
    const { http } = setup(
      () =>
        new Response('{"message":"case not found"}', {
          status: 404,
          headers: { "x-request": "1" },
        }),
    );

    const error = await http.get("/items/1", itemSchema).catch((e) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(404);
    expect(error.headers.get("x-request")).toBe("1");
    expect(error.body).toBe('{"message":"case not found"}');
  });

  test("marks listed upstream statuses for passthrough", async () => {
    const { http } = setup(() => new Response("missing", { status: 404 }));

    const listed = await http
      .get("/items/1", itemSchema, { passthrough: [404, 422] })
      .catch((e) => e);
    const unlisted = await http
      .get("/items/1", itemSchema, { passthrough: [422] })
      .catch((e) => e);
    const none = await http.get("/items/1", itemSchema).catch((e) => e);

    expect(listed.passthrough).toBe(true);
    expect(unlisted.passthrough).toBe(false);
    expect(none.passthrough).toBe(false);
  });

  test("throws UnexpectedResponseError when the body does not match the schema", async () => {
    const { http } = setup(() => Response.json({ id: "not a number" }));

    const error = await http.get("/items/1", itemSchema).catch((e) => e);

    expect(error).toBeInstanceOf(UnexpectedResponseError);
    expect(error.cause).toBeInstanceOf(z.ZodError);
  });

  test("throws UnexpectedResponseError when the body is not JSON", async () => {
    const { http } = setup(() => new Response("<html>oops</html>"));

    const error = await http.get("/items/1", itemSchema).catch((e) => e);

    expect(error).toBeInstanceOf(UnexpectedResponseError);
    expect(error.cause).toBeInstanceOf(SyntaxError);
  });

  test("wraps network errors in HttpNetworkError", async () => {
    const { http } = setup(() => Promise.reject(new Error("network down")));

    const error = await http.get("/items/1", itemSchema).catch((e) => e);

    expect(error).toBeInstanceOf(HttpNetworkError);
    expect(error.name).toBe("HttpNetworkError");
    expect(error.cause.message).toBe("network down");
  });

  test("wraps a connection dropped while reading the body in HttpNetworkError", async () => {
    const { http } = setup(
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error("connection reset"));
            },
          }),
        ),
    );

    const error = await http.get("/items/1", itemSchema).catch((e) => e);

    expect(error).toBeInstanceOf(HttpNetworkError);
    expect(error.cause.message).toBe("connection reset");
  });

  test("wraps timeouts in HttpTimeoutError", async () => {
    const { http } = setup(() =>
      Promise.reject(new DOMException("timed out", "TimeoutError")),
    );

    const error = await http.get("/items/1", itemSchema).catch((e) => e);

    expect(error).toBeInstanceOf(HttpTimeoutError);
    expect(error.name).toBe("HttpTimeoutError");
  });

  test("every failure is an HttpClientError", async () => {
    const responses = [
      () => new Response("nope", { status: 500 }),
      () => new Response("not json"),
      () => Promise.reject(new Error("network down")),
      () => Promise.reject(new DOMException("timed out", "TimeoutError")),
    ];

    for (const response of responses) {
      const { http } = setup(response);
      const error = await http.get("/items/1", itemSchema).catch((e) => e);
      expect(error).toBeInstanceOf(HttpClientError);
    }
  });
});

describe("HttpClient.forRequest", () => {
  test("logs through the request logger and forwards the request id", async () => {
    const { http, calls, entries, headers } = setup(() =>
      Response.json({ id: 1 }),
    );
    const request = createTestLogger();

    const scoped = http.forRequest({
      logger: request.logger.child({ requestId: "req-1" }),
      requestId: "req-1",
    });
    expect(await scoped.get("/items/1", itemSchema)).toEqual({ id: 1 });

    expect(calls[0]?.url).toBe("https://api.example.com/items/1");
    expect(headers().get("X-Request-Id")).toBe("req-1");
    expect(headers().get("Authorization")).toBe("Bearer secret");
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
    expect(entries).toHaveLength(0);
    expect(request.entries[0]).toMatchObject({
      msg: "outgoing request completed",
      requestId: "req-1",
    });
  });

  test("leaves the original client untouched", async () => {
    const { http, headers } = setup(() => Response.json({ id: 1 }));

    http.forRequest({ logger: createTestLogger().logger, requestId: "req-1" });
    await http.get("/items/1", itemSchema);

    expect(headers().has("X-Request-Id")).toBe(false);
  });
});

describe("HttpClient logging", () => {
  test("logs successful requests at info with method, url, status and duration", async () => {
    const { http, entries } = setup(() => Response.json({ id: 1 }));

    await http.get("/items/1", itemSchema);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: 30,
      msg: "outgoing request completed",
      method: "GET",
      url: "https://api.example.com/items/1",
      status: 200,
    });
    expect(entries[0]?.durationMs).toBeNumber();
  });

  test("logs non-2xx responses at warn", async () => {
    const { http, entries } = setup(
      () => new Response("nope", { status: 503 }),
    );

    await http.get("/items/1", itemSchema).catch(() => undefined);

    expect(entries[0]).toMatchObject({ level: 40, status: 503 });
  });

  test("logs network errors at warn", async () => {
    const { http, entries } = setup(() =>
      Promise.reject(new Error("network down")),
    );

    await http.get("/items/1", itemSchema).catch(() => undefined);

    expect(entries[0]).toMatchObject({
      level: 40,
      msg: "outgoing request failed",
      method: "GET",
      err: { message: "network down" },
    });
  });

  test("never logs query strings or headers", async () => {
    const { http, entries } = setup(() => Response.json({ id: 1 }));

    await http.get("/items", itemSchema, { query: { token: "q-secret" } });

    const logged = JSON.stringify(entries);
    expect(entries[0]?.url).toBe("https://api.example.com/items");
    expect(logged).not.toContain("q-secret");
    expect(logged).not.toContain("Bearer secret");
  });
});
