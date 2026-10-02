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
| `bun run lint`          | Lint with oxlint (type-aware, see `.oxlintrc.json`)          |
| `bun run format`        | Format all files with Prettier                               |
| `bun run format:check`  | Verify formatting (for CI)                                   |
| `bun run check`         | Format check + lint + typecheck + tests — run before pushing |
| `bun run docker:build`  | Build the Docker image with the current commit info baked in |
| `bun run client:build`  | Build the frontend client package into `dist-client/`        |
| `bun run client:verify` | Build + type-check the client as a frontend would            |

## Git hooks

`bun install` points git at `.githooks/` (via the `prepare` script), so the checks CI runs also run locally:

| Hook         | Runs                                                                             |
| ------------ | -------------------------------------------------------------------------------- |
| `pre-commit` | Formats the staged files with Prettier (and re-stages them), then `bun run lint` |
| `pre-push`   | `bun run check` and `bun run client:verify` — the same steps as CI               |

`pre-commit` refuses files that have both staged and unstaged changes, because re-staging the formatted file would also stage the rest. Skip a hook in an emergency with `--no-verify`.

## Configuration

All configuration comes from env vars. Server settings are validated on startup in `src/config/env.ts`.

| Variable             | Default                   | Set by                    | Description                                                                                                     |
| -------------------- | ------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`           | `development`             | Dockerfile (`production`) | `production` makes `ALLOWED_ORIGINS` required                                                                   |
| `PORT`               | `3000`                    | Dockerfile (`3000`)       | Port the server listens on                                                                                      |
| `LOG_LEVEL`          | `info`                    | Dockerfile (`info`)       | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`                                                  |
| `LOG_FORMAT`         | `json`                    | `bun run dev` (`pretty`)  | `json` or `pretty`; `pretty` needs the dev dependency `pino-pretty`, so it is not available in the Docker image |
| `GIT_COMMIT_HASH`    | none                      | Docker build arg (CI)     | Full commit hash                                                                                                |
| `GIT_COMMIT_MESSAGE` | none                      | Docker build arg (CI)     | Commit subject                                                                                                  |
| `GIT_COMMIT_AUTHOR`  | none                      | Docker build arg (CI)     | Commit author name                                                                                              |
| `GIT_COMMIT_DATE`    | none                      | Docker build arg (CI)     | Commit date (ISO 8601)                                                                                          |
| `ALLOWED_ORIGINS`    | `[]` (no origins allowed) | Deployment                | Comma-separated frontend origins allowed to call the API (CORS)                                                 |

- **Dockerfile:** sets `NODE_ENV`, `PORT` and `LOG_LEVEL` in the image. A deployment env var with the same name overrides them.
- **Docker build args:** CI passes the four `GIT_COMMIT_*` values when it builds the image (`bun run docker:build` does the same locally). They are baked into the image.
- **Deployment:** must set `ALLOWED_ORIGINS`, otherwise the server refuses to start in production (and browsers would block every frontend request).
- **Local development:** no setup needed, all defaults work and commit info is read from the local git repository. To call the API from a local frontend, create a `.env` (git-ignored, loaded by Bun automatically) with e.g. `ALLOWED_ORIGINS=http://localhost:5173`.

## Endpoints

- `GET /` and `GET /health` — `{ status: "ok", commit: { hash, shortHash, message, author, date } | null }`

Commit info is resolved once at startup, in this order:

1. all four `GIT_COMMIT_*` env vars (baked into the image by CI)
2. the local git repository (development)

If none of these succeed, `commit` is `null` and a warning is logged at startup.

## Docker

```sh
bun run docker:build   # build image `iusta-connector` with current commit info
bun run docker:run     # start container `iusta-connector` on port 3000 (replaces a running one)
bun run docker:logs    # follow logs
bun run docker:stop    # stop (container is removed automatically)
```

`docker:run` reads runtime env vars from `.env.docker` (git-ignored). The image runs with `NODE_ENV=production`, so it must set the deployment variables from [Configuration](#configuration):

```sh
ALLOWED_ORIGINS=http://localhost:5173
```

## Deployment

The `image` job in `.github/workflows/ci.yml` runs on every push to `main`, after all checks pass:

1. builds the Docker image with the four `GIT_COMMIT_*` build args;
2. pushes it to `ghcr.io/arthurzakharov/iusta-connector`, tagged with the commit hash and `latest`;
3. calls the `DEPLOY_HOOK_URL` repository secret with `imgURL` set to that exact image, so the platform deploys the image CI built and tested.

The platform only pulls the image and sets the runtime env vars (`ALLOWED_ORIGINS`); it does not build anything. Without the `DEPLOY_HOOK_URL` secret, the job still pushes the image and skips the deploy.

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

## Code style

Rules marked **(enforced)** fail `bun run check`, and therefore CI.

**Formatting and imports**

- Prettier formats everything: double quotes, semicolons, trailing commas, 80 columns **(enforced)**.
- Import from `src` with `@/…` and from `tests` with `@tests/…`; use `import type` for type-only imports **(enforced)**.
- Import concrete files, not folders: there are no `index.ts` barrel files, because the client build cannot resolve them.

**Types**

- Use `type`, not `interface` **(enforced)**.
- Exported functions and public methods declare their return type **(enforced)**. Exception: `src/app.ts`, `src/routes/**` and `src/client.ts`, where Hono infers the route types that become `AppType` and the client types.
- Name the object argument of a function `<FunctionName>Params` (e.g. `CreateAppParams`) and of a class constructor `<ClassName>Constructor` (e.g. `HttpClientConstructor`).
- Destructure object arguments in the signature. Pass the object on unchanged only when the function just forwards it.
- An optional property that callers may set to `undefined` is typed `name?: T | undefined` (`exactOptionalPropertyTypes` is on).
- Only export what another file uses.

**Structure**

- Folders: `api/` for requests to external services, `lib/` for app logic, `routes/` and `middleware/` for Hono, `config/` for env parsing, `types/` for types shared with the frontend client (import-free, so the client package ships no server code). File names are kebab-case.
- Pass dependencies such as the logger as arguments (no singletons); the logger is always required.
- Use a class only when there is shared state (e.g. `HttpClient`); mark members `public` or `private` explicitly, without `#` fields. Stateless logic stays in plain functions.
- Await or return every promise **(enforced)**.
- Keep names in the code platform-neutral (no GitHub/GitLab/Render names); platform specifics belong in CI and deployment config.
- Tests mirror `src/` under `tests/`; coverage must stay at 100% **(enforced)**.

## Adding an endpoint

1. Create `src/routes/<name>.ts` exporting a chained `new Hono()` router.
2. Mount it in `src/app.ts` via `.route(...)` (keep it chained so `AppType` stays typed).
3. Add tests under `tests/routes/` — coverage is enforced at 100%.

The new route is automatically part of the client types; publish a new tag so frontends get it.
