/**
 * Type-checks the built `dist-client/` package from a frontend's point of view:
 * strict mode, skipLibCheck off, only `hono` installed, for both `bundler` and `nodenext` resolution,
 * with our TypeScript and with TypeScript 5.x (what most Vite/React projects still use).
 * Uses @ts-expect-error on an unknown route to prove the client is typed (not `any`).
 */
import { $ } from "bun";
import { cp, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const consumer = await mkdtemp(join(tmpdir(), "iusta-client-consumer-"));

const consumerSource = `
import { createIustaClient, type HealthResponse, type IustaClient } from "@arthurzakharov/iusta-connector-client";

const api: IustaClient = createIustaClient("https://connector.example.com");
const res = await api.health.$get();
const body: HealthResponse = await res.json();
const hash: string | undefined = body.commit?.shortHash;
console.log(hash);

// @ts-expect-error unknown routes must be a type error
api.doesNotExist.$get();
`;

try {
  const pkgDir = join(
    consumer,
    "node_modules/@arthurzakharov/iusta-connector-client",
  );
  await mkdir(join(consumer, "node_modules/@arthurzakharov"), {
    recursive: true,
  });
  await cp(join(root, "dist-client"), pkgDir, { recursive: true });
  await symlink(
    join(root, "node_modules/hono"),
    join(consumer, "node_modules/hono"),
  );
  await Bun.write(join(consumer, "package.json"), `{ "type": "module" }`);
  await Bun.write(join(consumer, "index.ts"), consumerSource);

  for (const [module, moduleResolution] of [
    ["preserve", "bundler"],
    ["nodenext", "nodenext"],
  ]) {
    await Bun.write(
      join(consumer, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM"],
          module,
          moduleResolution,
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          types: [],
        },
        include: ["index.ts"],
      }),
    );
    await $`bunx --bun tsc -p ${consumer}`.cwd(root);
    await $`bunx --bun -p typescript@5 tsc -p ${consumer}`.cwd(root);
    console.log(
      `client types OK with TS 7 and TS 5 (moduleResolution: ${moduleResolution})`,
    );
  }
} finally {
  await rm(consumer, { recursive: true, force: true });
}
