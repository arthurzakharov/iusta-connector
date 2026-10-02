import { z } from "zod";
import type { Logger } from "@/lib/logger-types";

export type CommitInfo = {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
};

type EnvSource = Record<string, string | undefined>;

const SHORT_HASH_LENGTH = 7;
const FIELD_SEPARATOR = "\x1f";

function toCommitInfo(
  hash: string,
  message: string,
  author: string,
  date: string,
): CommitInfo {
  return {
    hash,
    shortHash: hash.slice(0, SHORT_HASH_LENGTH),
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
  return toCommitInfo(
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
    return toCommitInfo(hash, message, author, date);
  } catch {
    return null;
  }
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

type RemoteCommitOptions = {
  repository: string;
  hash: string;
  token?: string | undefined;
  timeoutMs?: number;
  fetch?: FetchFn;
  logger?: Logger | undefined;
};

const remoteCommitSchema = z.object({
  sha: z.string(),
  commit: z.object({
    message: z.string(),
    author: z.object({ name: z.string() }),
    committer: z.object({ date: z.string() }),
  }),
});

/** Looks up a commit in the remote repository API (used when only the commit hash is known). */
export async function commitInfoFromRemote({
  repository,
  hash,
  token,
  timeoutMs = 3000,
  fetch = globalThis.fetch,
  logger,
}: RemoteCommitOptions) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repository}/commits/${hash}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "iusta-connector",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!res.ok) {
      logger?.warn(
        {
          status: res.status,
          rateLimitRemaining: res.headers.get("x-ratelimit-remaining"),
          rateLimitReset: res.headers.get("x-ratelimit-reset"),
          authenticated: Boolean(token),
        },
        "remote commit lookup failed",
      );
      return null;
    }

    const parsed = remoteCommitSchema.safeParse(await res.json());
    if (!parsed.success) {
      logger?.warn("remote commit lookup returned an unexpected payload");
      return null;
    }

    const { sha, commit } = parsed.data;
    const subject = commit.message.split("\n", 1)[0] ?? "";
    return toCommitInfo(
      sha,
      subject,
      commit.author.name,
      commit.committer.date,
    );
  } catch (err) {
    logger?.warn({ err }, "remote commit lookup request failed");
    return null;
  }
}

type ResolveCommitInfoOptions = {
  cwd?: string;
  fetch?: FetchFn;
  logger?: Logger;
};

/**
 * Get commit info. Resolution order:
 * 1. local Docker env vars (development)
 * 2. local git repository (development)
 * 3. remote repository API using GIT_COMMIT_HASH + GIT_REPOSITORY (when only the hash is known)
 */
export async function resolveCommitInfo(
  env: EnvSource,
  { cwd, fetch, logger }: ResolveCommitInfoOptions = {},
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
    ...(fetch && { fetch }),
  });
}
