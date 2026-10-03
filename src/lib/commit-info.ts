export type CommitInfo = {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
};

type CommitEnv = {
  GIT_COMMIT_HASH?: string | undefined;
  GIT_COMMIT_MESSAGE?: string | undefined;
  GIT_COMMIT_AUTHOR?: string | undefined;
  GIT_COMMIT_DATE?: string | undefined;
};

function toCommitInfo(
  hash: string,
  message: string,
  author: string,
  date: string,
): CommitInfo {
  return {
    hash,
    shortHash: hash.slice(0, 7),
    message,
    author,
    date,
  };
}

export function commitInfoFromEnv(env: CommitEnv): CommitInfo | null {
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

export function commitInfoFromGit(cwd?: string): CommitInfo | null {
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
    return toCommitInfo(hash, message, author, date);
  } catch {
    return null;
  }
}

export function resolveCommitInfo(
  env: CommitEnv,
  cwd?: string,
): CommitInfo | null {
  return commitInfoFromEnv(env) ?? commitInfoFromGit(cwd);
}
