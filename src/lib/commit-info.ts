import { z } from 'zod'

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

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

export type GitHubCommitOptions = {
  repoSlug: string
  sha: string
  token?: string | undefined
  timeoutMs?: number
  fetch?: FetchFn
}

const gitHubCommitSchema = z.object({
  sha: z.string(),
  commit: z.object({
    message: z.string(),
    author: z.object({ name: z.string() }),
    committer: z.object({ date: z.string() }),
  }),
})

/** Looks up a commit via the GitHub API (used on hosts like Render that only expose the commit SHA). */
export async function commitInfoFromGitHub({
  repoSlug,
  sha,
  token,
  timeoutMs = 3000,
  fetch = globalThis.fetch,
}: GitHubCommitOptions): Promise<CommitInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repoSlug}/commits/${sha}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'iusta-connector',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null

    const parsed = gitHubCommitSchema.safeParse(await res.json())
    if (!parsed.success) return null

    const { sha: hash, commit } = parsed.data
    const subject = commit.message.split('\n', 1)[0] ?? ''
    return toCommitInfo(hash, subject, commit.author.name, commit.committer.date)
  } catch {
    return null
  }
}

export type ResolveCommitInfoOptions = {
  cwd?: string
  fetch?: FetchFn
}

/**
 * Resolution order:
 * 1. GIT_COMMIT_* env vars (local `bun run docker:build`)
 * 2. local git repository (development)
 * 3. GitHub API using RENDER_GIT_REPO_SLUG + RENDER_GIT_COMMIT (Render deploys)
 */
export async function resolveCommitInfo(
  env: EnvSource,
  { cwd, fetch }: ResolveCommitInfoOptions = {},
): Promise<CommitInfo | null> {
  const local = commitInfoFromEnv(env) ?? commitInfoFromGit(cwd)
  if (local) return local

  const { RENDER_GIT_REPO_SLUG, RENDER_GIT_COMMIT, GITHUB_TOKEN } = env
  if (!RENDER_GIT_REPO_SLUG || !RENDER_GIT_COMMIT) return null

  return commitInfoFromGitHub({
    repoSlug: RENDER_GIT_REPO_SLUG,
    sha: RENDER_GIT_COMMIT,
    token: GITHUB_TOKEN,
    ...(fetch && { fetch }),
  })
}
