import { hc, type ClientRequestOptions } from "hono/client";
import type { AppType } from "@/app";

export type { AppType, CommitInfo, HealthResponse } from "@/app";

/** Typed API client for frontends. Paths, params, bodies and responses are inferred from the server routes. */
export function createIustaClient(
  baseUrl: string,
  options?: ClientRequestOptions,
) {
  return hc<AppType>(baseUrl, options);
}

export type IustaClient = ReturnType<typeof createIustaClient>;
