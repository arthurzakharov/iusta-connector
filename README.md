# iusta-connector

Connector between our frontend applications and iusta. Built with [Bun](https://bun.sh) + [Hono](https://hono.dev).

## Scripts

| Command | Description |
|---|---|
| `bun install` | Install dependencies |
| `bun run dev` | Start with watch mode and pretty logs |
| `bun run start` | Start the server |
| `bun test` | Run tests with coverage (fails below 100% lines/functions) |
| `bun run typecheck` | Type-check with `tsc` |
| `bun run docker:build` | Build the Docker image with the current commit info baked in |

Configuration is read from env vars and validated on startup (see `src/config/env.ts` and `.env.example`).

## Endpoints

- `GET /` and `GET /health` — `{ status: "ok", commit: { hash, shortHash, message, author, date } | null }`

Commit info is resolved once at startup, in this order:

1. `GIT_COMMIT_*` env vars (set as Docker build args by `bun run docker:build`)
2. the local git repository (development)
3. the GitHub API, using `RENDER_GIT_REPO_SLUG` + `RENDER_GIT_COMMIT` that Render sets automatically. Set `GITHUB_TOKEN` (read-only, `contents:read`) if the repository becomes private.

## Docker

```sh
bun run docker:build   # build image `iusta-connector` with current commit info
bun run docker:run     # start container `iusta-connector` on port 3000 (replaces a running one)
bun run docker:logs    # follow logs
bun run docker:stop    # stop (container is removed automatically)
```

## Typed client for frontends

```ts
import { hc } from 'hono/client'
import type { AppType } from 'iusta-connector'

const api = hc<AppType>('https://connector.example.com')
const res = await api.health.$get()
```

## Adding an endpoint

1. Create `src/routes/<name>.ts` exporting a chained `new Hono()` router.
2. Mount it in `src/app.ts` via `.route(...)` (keep it chained so `AppType` stays typed).
3. Add tests under `tests/routes/` — coverage is enforced at 100%.
