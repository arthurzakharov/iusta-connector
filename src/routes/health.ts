import { Hono } from "hono";
import type { CommitInfo, HealthResponse } from "@/types/responses";

export function createHealthRoutes(commitInfo: CommitInfo | null) {
  const body: HealthResponse = { status: "ok", commit: commitInfo };

  return new Hono()
    .get("/", (c) => c.json(body))
    .get("/health", (c) => c.json(body));
}
