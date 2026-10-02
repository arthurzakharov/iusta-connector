import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { hc } from "hono/client";
import { requestId } from "hono/request-id";
import { z } from "zod";
import { errorHandler } from "@/middleware/error-handler";
import { validate } from "@/middleware/validate";
import type { ErrorResponse } from "@/types/responses";
import { createTestLogger } from "@tests/helpers/logger";

const caseSchema = z.object({ title: z.string().min(1), amount: z.number() });
const listSchema = z.object({ page: z.coerce.number().int().positive() });

function createTestApp() {
  const { logger } = createTestLogger();
  return new Hono()
    .use(requestId())
    .post("/cases", validate("json", caseSchema), (c) =>
      c.json(c.req.valid("json"), 201),
    )
    .get("/cases", validate("query", listSchema), (c) =>
      c.json(c.req.valid("query")),
    )
    .onError(errorHandler(logger));
}

describe("validate", () => {
  test("passes valid input to the handler as parsed data", async () => {
    const app = createTestApp();

    const created = await app.request("/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Rent", amount: 100 }),
    });
    const listed = await app.request("/cases?page=2");

    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ title: "Rent", amount: 100 });
    expect(await listed.json()).toEqual({ page: 2 });
  });

  test("answers invalid input with 400 and one issue per field, prefixed with the target", async () => {
    const app = createTestApp();

    const res = await app.request("/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Id": "r-1" },
      body: JSON.stringify({ title: "", amount: "100" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorResponse;
    expect(body).toMatchObject({ error: "Bad Request", requestId: "r-1" });
    expect(body.issues?.map((issue) => issue.path)).toEqual([
      "json.title",
      "json.amount",
    ]);
  });

  test("validates query parameters", async () => {
    const res = await createTestApp().request("/cases?page=0");

    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorResponse;
    expect(body.issues?.[0]?.path).toBe("query.page");
  });

  test("makes the validated input part of the client types", () => {
    const client = hc<ReturnType<typeof createTestApp>>("http://localhost");

    // Compile-time check only: the request is never sent.
    const send = (): unknown => [
      client.cases.$post({ json: { title: "Rent", amount: 100 } }),
      // @ts-expect-error amount must be a number
      client.cases.$post({ json: { title: "Rent", amount: "100" } }),
    ];

    expect(send).toBeFunction();
  });
});
