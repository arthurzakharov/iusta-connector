export type CommitInfo = {
  hash: string
  shortHash: string
  message: string
  author: string
  date: string
}

type EnvSource = Record<string, string | undefined>

const SHORT_HASH_LENGTH = 7
const FIELD_SEPARATOR = '\x1f'

function toCommitInfo(hash: string, message: string, author: string, date: string): CommitInfo {
  return { hash, shortHash: hash.slice(0, SHORT_HASH_LENGTH), message, author, date }
}

/** Reads commit info injected at build time (e.g. Docker build args). */
export function commitInfoFromEnv(env: EnvSource): CommitInfo | null {
  const { GIT_COMMIT_HASH, GIT_COMMIT_MESSAGE, GIT_COMMIT_AUTHOR, GIT_COMMIT_DATE } = env
  if (!GIT_COMMIT_HASH || !GIT_COMMIT_MESSAGE || !GIT_COMMIT_AUTHOR || !GIT_COMMIT_DATE) {
    return null
  }
  return toCommitInfo(GIT_COMMIT_HASH, GIT_COMMIT_MESSAGE, GIT_COMMIT_AUTHOR, GIT_COMMIT_DATE)
}

/** Reads the last commit from the local git repository (development fallback). */
export function commitInfoFromGit(cwd?: string): CommitInfo | null {
  try {
    const result = Bun.spawnSync(
      ['git', 'log', '-1', `--format=%H${FIELD_SEPARATOR}%s${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%cI`],
      { ...(cwd && { cwd }), stdout: 'pipe', stderr: 'ignore' },
    )
    if (!result.success) return null

    const [hash, message, author, date] = result.stdout.toString().trim().split(FIELD_SEPARATOR)
    if (!hash || !message || !author || !date) return null
    return toCommitInfo(hash, message, author, date)
  } catch {
    return null
  }
}

export function resolveCommitInfo(env: EnvSource, cwd?: string): CommitInfo | null {
  return commitInfoFromEnv(env) ?? commitInfoFromGit(cwd)
}
