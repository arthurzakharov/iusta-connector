import { z } from "zod";
import { type HttpError, HttpClient } from "@/api/http-client";

type RepositoryApiConstructor = {
  repository: string;
  token?: string | undefined;
};

const commitSchema = z.object({
  sha: z.string(),
  commit: z.object({
    message: z.string(),
    author: z.object({ name: z.string() }),
    committer: z.object({ date: z.string() }),
  }),
});

/**
 * API of the host the git repository lives on.
 * Host-specific details (base URL, headers, paths, response shapes) stay in this class.
 */
export class RepositoryApi {
  private readonly http: HttpClient;
  private readonly repository: string;

  public constructor({ repository, token }: RepositoryApiConstructor) {
    this.repository = repository;
    this.http = new HttpClient({
      baseUrl: "https://api.github.com",
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "iusta-connector",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
  }

  public async getCommit(hash: string) {
    const { sha, commit } = await this.http.get(
      this.path.commits(hash),
      commitSchema,
    );

    return {
      hash: sha,
      message: commit.message,
      author: commit.author.name,
      date: commit.committer.date,
    };
  }

  public rateLimit(error: HttpError) {
    return {
      remaining: error.headers.get("x-ratelimit-remaining"),
      reset: error.headers.get("x-ratelimit-reset"),
    };
  }

  private get path() {
    return {
      commits: (hash: string) => `/repos/${this.repository}/commits/${hash}`,
    };
  }
}
