import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  HttpClient,
  HttpError,
  UnexpectedResponseError,
} from "@/api/http-client";

const itemSchema = z.object({ id: z.number() });

type FetchCall = { url: string; init?: RequestInit | undefined };

function setup(response: () => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  const http = new HttpClient({
    baseUrl: "https://api.example.com",
    headers: { Authorization: "Bearer secret" },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return response();
    },
  });
  return { http, calls };
}

describe("HttpClient", () => {
  test("GET joins the base URL, sends default headers and parses the body", async () => {
    const { http, calls } = setup(() => Response.json({ id: 1 }));

    expect(await http.get("/items/1", itemSchema)).toEqual({ id: 1 });
    expect(calls[0]?.url).toBe("https://api.example.com/items/1");
    expect(calls[0]?.init?.method).toBe("GET");
    expect(new Headers(calls[0]?.init?.headers).get("Authorization")).toBe(
      "Bearer secret",
    );
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  test("POST sends a JSON body alongside the default headers", async () => {
    const { http, calls } = setup(() => Response.json({ id: 2 }));

    await http.post("/items", { name: "new" }, itemSchema);

    const headers = new Headers(calls[0]?.init?.headers);
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.body).toBe('{"name":"new"}');
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer secret");
  });

  test("throws HttpError with status and headers for non-2xx responses", async () => {
    const { http } = setup(
      () =>
        new Response("nope", { status: 404, headers: { "x-request": "1" } }),
    );

    const error = await http.get("/items/1", itemSchema).catch((e) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(404);
    expect(error.headers.get("x-request")).toBe("1");
  });

  test("throws UnexpectedResponseError when the body does not match the schema", async () => {
    const { http } = setup(() => Response.json({ id: "not a number" }));

    const error = await http.get("/items/1", itemSchema).catch((e) => e);

    expect(error).toBeInstanceOf(UnexpectedResponseError);
    expect(error.cause).toBeInstanceOf(z.ZodError);
  });

  test("passes network errors through unchanged", async () => {
    const { http } = setup(() => Promise.reject(new Error("network down")));

    await expect(http.get("/items/1", itemSchema)).rejects.toThrow(
      "network down",
    );
  });
});
