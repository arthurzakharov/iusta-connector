import { Hono } from "hono";
import type { CommitInfo } from "@/lib/commit-info";
import type { HealthResponse } from "@/types/responses";

export function createHealthRoutes(commitInfo: CommitInfo | null) {
  const body: HealthResponse = {
    status: "ok",
    commit: commitInfo && {
      shortHash: commitInfo.shortHash,
      date: commitInfo.date,
    },
  };

  return new Hono()
    .get("/", (c) => c.json(body))
    .get("/health", (c) => c.json(body));
}
