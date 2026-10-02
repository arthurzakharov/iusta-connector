# iusta-connector

Connector between our frontend applications and iusta. Built with [Bun](https://bun.sh) + [Hono](https://hono.dev).

## Scripts

| Command                 | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| `bun install`           | Install dependencies                                         |
| `bun run dev`           | Start with watch mode and pretty logs                        |
| `bun run start`         | Start the server                                             |
| `bun test`              | Run tests with coverage (fails below 100% lines/functions)   |
| `bun run typecheck`     | Type-check with `tsc`                                        |
| `bun run format`        | Format all files with Prettier                               |
| `bun run format:check`  | Verify formatting (for CI)                                   |
| `bun run check`         | Format check + typecheck + tests — run before pushing        |
| `bun run docker:build`  | Build the Docker image with the current commit info baked in |
| `bun run client:build`  | Build the frontend client package into `dist-client/`        |
| `bun run client:verify` | Build + type-check the client as a frontend would            |

## Configuration

All configuration comes from env vars. Server settings are validated on startup in `src/config/env.ts`.

| Variable               | Default                   | Set by                    | Description                                                     |
| ---------------------- | ------------------------- | ------------------------- | --------------------------------------------------------------- |
| `NODE_ENV`             | `development`             | Dockerfile (`production`) | `development` enables pretty logs                               |
| `PORT`                 | `3000`                    | Dockerfile (`3000`)       | Port the server listens on                                      |
| `LOG_LEVEL`            | `info`                    | Dockerfile (`info`)       | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`  |
| `GIT_COMMIT_HASH`      | none                      | Docker build arg          | Full commit hash                                                |
| `GIT_COMMIT_MESSAGE`   | none                      | Docker build arg          | Commit subject                                                  |
| `GIT_COMMIT_AUTHOR`    | none                      | Docker build arg          | Commit author name                                              |
| `GIT_COMMIT_DATE`      | none                      | Docker build arg          | Commit date (ISO 8601)                                          |
| `ALLOWED_ORIGINS`      | `[]` (no origins allowed) | Deployment                | Comma-separated frontend origins allowed to call the API (CORS) |
| `GIT_REPOSITORY_NAME`  | none                      | Deployment                | Repository path on the host, e.g. `owner/name`                  |
| `GIT_REPOSITORY_TOKEN` | none                      | Deployment                | Token with read-only access to repository contents              |

- **Dockerfile:** sets `NODE_ENV`, `PORT` and `LOG_LEVEL` in the image. A deployment env var with the same name overrides them.
- **Docker build args:** the build pipeline passes the four `GIT_COMMIT_*` values (`bun run docker:build` does this locally). They are baked into the image.
- **Deployment:** must set `ALLOWED_ORIGINS` (otherwise browsers block every frontend request), `GIT_REPOSITORY_NAME` and `GIT_REPOSITORY_TOKEN` (store the token as a secret). They are read at runtime and are not part of the image.
- **Local development:** no setup needed, all defaults work and commit info is read from the local git repository. To call the API from a local frontend, create a `.env` (git-ignored, loaded by Bun automatically) with e.g. `ALLOWED_ORIGINS=http://localhost:5173`.

## Endpoints

- `GET /` and `GET /health` — `{ status: "ok", commit: { hash, shortHash, message, author, date } | null }`

Commit info is resolved once at startup, in this order:

1. all four `GIT_COMMIT_*` env vars
2. the local git repository (development)
3. the remote repository API, looking up `GIT_COMMIT_HASH` in `GIT_REPOSITORY_NAME` (when only the hash is known)

If none of these succeed, `commit` is `null` and a warning is logged at startup.

The remote repository host (base URL, auth headers, endpoint paths, response shape) is configured in `src/api/repository-api.ts` — that is the only file to change when moving to another host.

## Docker

```sh
bun run docker:build   # build image `iusta-connector` with current commit info
bun run docker:run     # start container `iusta-connector` on port 3000 (replaces a running one)
bun run docker:logs    # follow logs
bun run docker:stop    # stop (container is removed automatically)
```

`docker:run` reads runtime env vars from `.env.docker` (git-ignored). The image runs with `NODE_ENV=production`, so it must contain the deployment variables from [Configuration](#configuration):

```sh
ALLOWED_ORIGINS=http://localhost:5173
GIT_REPOSITORY_NAME=owner/name
GIT_REPOSITORY_TOKEN=<token>
```

## Typed client for frontends

Published to GitHub Packages as `@arthurzakharov/iusta-connector-client` (types + a tiny `hono/client` wrapper, no server code).

### Using it in a frontend

1. Create a GitHub **classic** personal access token with the `read:packages` scope.
2. Add `.npmrc` to the frontend repo (commit it — the token comes from an env var):

   ```ini
   @arthurzakharov:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
   ```

3. Install (with `GITHUB_TOKEN` exported in your shell / CI):

   ```sh
   bun add @arthurzakharov/iusta-connector-client hono
   ```

4. Use it:

   ```ts
   import { createIustaClient } from "@arthurzakharov/iusta-connector-client";

   const api = createIustaClient(import.meta.env.VITE_CONNECTOR_URL);
   const res = await api.health.$get();
   const body = await res.json(); // { status: "ok"; commit: CommitInfo | null }
   ```

The frontend origin must be listed in the connector's `ALLOWED_ORIGINS` env var (comma-separated), otherwise browsers block the requests (CORS).

### Publishing a new version

```sh
git tag v0.2.0 && git push origin v0.2.0
```

The `Publish client` workflow runs all checks, builds `dist-client/` and publishes `@arthurzakharov/iusta-connector-client@0.2.0`.
Use `bun run client:verify` locally to build the package and type-check it the way a frontend would.

## Adding an endpoint

1. Create `src/routes/<name>.ts` exporting a chained `new Hono()` router.
2. Mount it in `src/app.ts` via `.route(...)` (keep it chained so `AppType` stays typed).
3. Add tests under `tests/routes/` — coverage is enforced at 100%.

The new route is automatically part of the client types; publish a new tag so frontends get it.
