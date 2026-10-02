import { HttpError, UnexpectedResponseError } from "@/api/http-client";
import type { Logger } from "@/lib/logger-types";
import { RepositoryApi } from "@/api/repository-api";

export type CommitInfo = {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
};

type EnvSource = Record<string, string | undefined>;

export function getCommitInfo(
  hash: string,
  message: string,
  author: string,
  date: string,
) {
  return {
    hash,
    shortHash: hash.slice(0, 7),
    message,
    author,
    date,
  };
}

/**
 * Reads commit info injected at build time (e.g. Docker build args).
 */
export function commitInfoFromEnv(env: EnvSource) {
  const {
    GIT_COMMIT_HASH,
    GIT_COMMIT_MESSAGE,
    GIT_COMMIT_AUTHOR,
    GIT_COMMIT_DATE,
  } = env;
  if (
    !GIT_COMMIT_HASH ||
    !GIT_COMMIT_MESSAGE ||
    !GIT_COMMIT_AUTHOR ||
    !GIT_COMMIT_DATE
  ) {
    return null;
  }
  return getCommitInfo(
    GIT_COMMIT_HASH,
    GIT_COMMIT_MESSAGE,
    GIT_COMMIT_AUTHOR,
    GIT_COMMIT_DATE,
  );
}

/**
 * Reads the last commit from the local git repository (development fallback).
 */
export function commitInfoFromGit(cwd?: string) {
  const FIELD_SEPARATOR = "\x1f";

  try {
    const result = Bun.spawnSync(
      [
        "git",
        "log",
        "-1",
        `--format=%H${FIELD_SEPARATOR}%s${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%cI`,
      ],
      { ...(cwd && { cwd }), stdout: "pipe", stderr: "ignore" },
    );
    if (!result.success) return null;

    const [hash, message, author, date] = result.stdout
      .toString()
      .trim()
      .split(FIELD_SEPARATOR);
    if (!hash || !message || !author || !date) return null;
    return getCommitInfo(hash, message, author, date);
  } catch {
    return null;
  }
}

type RemoteCommitParams = {
  repository: string;
  hash: string;
  token?: string | undefined;
  logger: Logger;
};

/**
 * Looks up a commit in the remote repository API (used when only the commit hash is known).
 */
export async function commitInfoFromRemote({
  repository,
  hash,
  token,
  logger,
}: RemoteCommitParams) {
  const api = new RepositoryApi({ repository, token });

  try {
    const commit = await api.getCommit(hash);
    const subject = commit.message.split("\n", 1)[0] ?? "";
    return getCommitInfo(commit.hash, subject, commit.author, commit.date);
  } catch (err) {
    if (err instanceof HttpError) {
      const rateLimit = api.rateLimit(err);
      logger.warn(
        {
          status: err.status,
          rateLimitRemaining: rateLimit.remaining,
          rateLimitReset: rateLimit.reset,
          authenticated: Boolean(token),
        },
        "remote commit lookup failed",
      );
    } else if (err instanceof UnexpectedResponseError) {
      logger.warn("remote commit lookup returned an unexpected payload");
    } else {
      logger.warn({ err }, "remote commit lookup request failed");
    }
    return null;
  }
}

type ResolveCommitInfoParams = {
  cwd?: string;
  logger: Logger;
};

/**
 * Get commit info. Resolution order:
 * 1. local Docker env vars (development)
 * 2. local git repository (development)
 * 3. remote repository API using GIT_COMMIT_HASH + GIT_REPOSITORY (when only the hash is known)
 */
export async function resolveCommitInfo(
  env: EnvSource,
  { cwd, logger }: ResolveCommitInfoParams,
) {
  const local = commitInfoFromEnv(env) ?? commitInfoFromGit(cwd);

  if (local) return local;

  const { GIT_COMMIT_HASH, GIT_REPOSITORY, GIT_REPOSITORY_TOKEN } = env;

  if (!GIT_COMMIT_HASH || !GIT_REPOSITORY) return null;

  return commitInfoFromRemote({
    repository: GIT_REPOSITORY,
    hash: GIT_COMMIT_HASH,
    token: GIT_REPOSITORY_TOKEN,
    logger,
  });
}
