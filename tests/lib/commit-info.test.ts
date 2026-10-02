import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  commitInfoFromEnv,
  commitInfoFromGit,
  commitInfoFromRemote,
  resolveCommitInfo,
} from "@/lib/commit-info";
import { createTestLogger } from "@tests/helpers/logger";

const HASH = "abcdef0123456789abcdef0123456789abcdef01";
const fullEnv = {
  GIT_COMMIT_HASH: HASH,
  GIT_COMMIT_MESSAGE: "fix: something",
  GIT_COMMIT_AUTHOR: "Env Author",
  GIT_COMMIT_DATE: "2026-09-30T10:00:00Z",
};

function git(cwd: string, ...args: string[]) {
  Bun.spawnSync(["git", ...args], {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Git Author",
      GIT_AUTHOR_EMAIL: "git@example.com",
      GIT_COMMITTER_NAME: "Git Author",
      GIT_COMMITTER_EMAIL: "git@example.com",
      GIT_COMMITTER_DATE: "2026-09-29T08:30:00+00:00",
    },
  });
}

let repoDir: string;
let emptyDir: string;

beforeAll(() => {
  repoDir = mkdtempSync(join(tmpdir(), "commit-info-repo-"));
  emptyDir = mkdtempSync(join(tmpdir(), "commit-info-empty-"));
  git(repoDir, "init", "-q");
  git(repoDir, "commit", "-q", "--allow-empty", "-m", "chore: initial commit");
});

afterAll(() => {
  rmSync(repoDir, { recursive: true, force: true });
  rmSync(emptyDir, { recursive: true, force: true });
});

describe("commitInfoFromEnv", () => {
  test("builds commit info from GIT_COMMIT_* variables", () => {
    expect(commitInfoFromEnv(fullEnv)).toEqual({
      hash: HASH,
      shortHash: "abcdef0",
      message: "fix: something",
      author: "Env Author",
      date: "2026-09-30T10:00:00Z",
    });
  });

  test("returns null when any variable is missing", () => {
    expect(
      commitInfoFromEnv({ ...fullEnv, GIT_COMMIT_AUTHOR: undefined }),
    ).toBeNull();
    expect(commitInfoFromEnv({})).toBeNull();
  });
});

describe("commitInfoFromGit", () => {
  test("reads the last commit of a repository", () => {
    const info = commitInfoFromGit(repoDir);

    expect(info).toMatchObject({
      message: "chore: initial commit",
      author: "Git Author",
      date: "2026-09-29T08:30:00Z",
    });
    expect(info?.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(info?.shortHash).toBe(info!.hash.slice(0, 7));
  });

  test("returns null outside a git repository", () => {
    expect(commitInfoFromGit(emptyDir)).toBeNull();
  });

  test("returns null when git cannot be spawned", () => {
    expect(commitInfoFromGit(join(emptyDir, "missing-dir"))).toBeNull();
  });
});

const remoteCommit = {
  sha: HASH,
  commit: {
    message: "feat: deployed commit\n\nLonger description body",
    author: { name: "Remote Author" },
    committer: { date: "2026-10-02T09:15:00Z" },
  },
};

type FetchCall = { url: string; init?: RequestInit | undefined };

function mockFetch(response: () => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return response();
  };
  return { fetch, calls };
}

describe("commitInfoFromRemote", () => {
  test("maps the remote commit using only the first line of the message", async () => {
    const { fetch, calls } = mockFetch(() => Response.json(remoteCommit));

    const info = await commitInfoFromRemote({
      repository: "acme/repo",
      hash: HASH,
      fetch,
    });

    expect(info).toEqual({
      hash: HASH,
      shortHash: "abcdef0",
      message: "feat: deployed commit",
      author: "Remote Author",
      date: "2026-10-02T09:15:00Z",
    });
    expect(calls[0]?.url).toBe(
      `https://api.github.com/repos/acme/repo/commits/${HASH}`,
    );
    expect(new Headers(calls[0]?.init?.headers).has("Authorization")).toBe(
      false,
    );
  });

  test("sends a bearer token when provided", async () => {
    const { fetch, calls } = mockFetch(() => Response.json(remoteCommit));

    await commitInfoFromRemote({
      repository: "acme/repo",
      hash: HASH,
      token: "secret",
      fetch,
    });

    expect(new Headers(calls[0]?.init?.headers).get("Authorization")).toBe(
      "Bearer secret",
    );
  });

  test("returns null and logs status and rate limit for non-2xx responses", async () => {
    const { logger, entries } = createTestLogger();
    const { fetch } = mockFetch(
      () =>
        new Response("rate limited", {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": "1759400000",
          },
        }),
    );

    expect(
      await commitInfoFromRemote({
        repository: "acme/repo",
        hash: HASH,
        fetch,
        logger,
      }),
    ).toBeNull();
    expect(entries[0]).toMatchObject({
      msg: "remote commit lookup failed",
      status: 403,
      rateLimitRemaining: "0",
      rateLimitReset: "1759400000",
      authenticated: false,
    });
  });

  test("returns null and logs unexpected payloads", async () => {
    const { logger, entries } = createTestLogger();
    const { fetch } = mockFetch(() => Response.json({ sha: HASH }));

    expect(
      await commitInfoFromRemote({
        repository: "acme/repo",
        hash: HASH,
        fetch,
        logger,
      }),
    ).toBeNull();
    expect(entries[0]?.msg).toBe(
      "remote commit lookup returned an unexpected payload",
    );
  });

  test("returns null and logs the error when the request fails", async () => {
    const { logger, entries } = createTestLogger();
    const { fetch } = mockFetch(() =>
      Promise.reject(new Error("network down")),
    );

    expect(
      await commitInfoFromRemote({
        repository: "acme/repo",
        hash: HASH,
        fetch,
        logger,
      }),
    ).toBeNull();
    expect(entries[0]).toMatchObject({
      msg: "remote commit lookup request failed",
      err: { message: "network down" },
    });
  });

  test("does not require a logger", async () => {
    const { fetch } = mockFetch(
      () => new Response("Not Found", { status: 404 }),
    );
    expect(
      await commitInfoFromRemote({
        repository: "acme/repo",
        hash: HASH,
        fetch,
      }),
    ).toBeNull();
  });
});

describe("resolveCommitInfo", () => {
  const remoteEnv = {
    GIT_REPOSITORY: "acme/repo",
    GIT_COMMIT_HASH: HASH,
  };

  test("prefers env variables over git", async () => {
    expect((await resolveCommitInfo(fullEnv, { cwd: repoDir }))?.author).toBe(
      "Env Author",
    );
  });

  test("falls back to git when env variables are missing", async () => {
    expect((await resolveCommitInfo({}, { cwd: repoDir }))?.author).toBe(
      "Git Author",
    );
  });

  test("falls back to the remote repository when only the commit hash is known and git is unavailable", async () => {
    const { fetch, calls } = mockFetch(() => Response.json(remoteCommit));

    const info = await resolveCommitInfo(
      { ...remoteEnv, GIT_REPOSITORY_TOKEN: "secret" },
      { cwd: emptyDir, fetch },
    );

    expect(info?.author).toBe("Remote Author");
    expect(new Headers(calls[0]?.init?.headers).get("Authorization")).toBe(
      "Bearer secret",
    );
  });

  test("returns null without remote repository variables and without git", async () => {
    const { fetch, calls } = mockFetch(() => Response.json(remoteCommit));

    expect(await resolveCommitInfo({}, { cwd: emptyDir, fetch })).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
