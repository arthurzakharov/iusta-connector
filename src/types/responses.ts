/**
 * Types that appear in HTTP responses and are published with the frontend client.
 * Keep this file free of imports, so the client package contains no server code.
 */
export type CommitInfo = {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
};

export type ErrorResponse = {
  error: string;
  requestId: string;
};

export type HealthResponse = {
  status: "ok";
  commit: CommitInfo | null;
};
