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
