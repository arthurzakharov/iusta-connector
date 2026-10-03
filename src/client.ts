import { hc, type ClientRequestOptions } from "hono/client";
import type { AppType } from "@/app";

export type {
  AppType,
  ErrorResponse,
  HealthResponse,
  PublicCommitInfo,
  ValidationIssue,
} from "@/app";

export function createIustaClient(
  baseUrl: string,
  options?: ClientRequestOptions,
) {
  return hc<AppType>(baseUrl, options);
}

export type IustaClient = ReturnType<typeof createIustaClient>;
