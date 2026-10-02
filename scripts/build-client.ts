/**
 * Builds the publishable frontend client package into `dist-client/`:
 * - client.js: ESM bundle of src/client.ts (hono stays external, it's a peer dependency)
 * - *.d.ts: declarations with `@/` aliases rewritten to relative paths, so consumers can resolve them
 * - package.json: standalone manifest for GitHub Packages
 *
 * Version comes from CLIENT_VERSION (set from the git tag in CI) or falls back to the root package.json.
 */
import { $, Glob } from "bun";
import { rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

const root = join(import.meta.dir, "..");
const outDir = join(root, "dist-client");
const rootPkg = await Bun.file(join(root, "package.json")).json();
const version = (process.env.CLIENT_VERSION ?? rootPkg.version).replace(
  /^v/,
  "",
);

await rm(outDir, { recursive: true, force: true });

const build = await Bun.build({
  entrypoints: [join(root, "src/client.ts")],
  outdir: outDir,
  target: "browser",
  format: "esm",
  external: ["hono", "hono/*"],
});
if (!build.success) {
  for (const log of build.logs) console.error(log);
  process.exit(1);
}

await $`bunx tsc -p ${join(root, "tsconfig.client.json")}`.cwd(root);

const aliasPattern = /(["'])@\/([^"']+)\1/g;
for await (const file of new Glob("**/*.d.ts").scan(outDir)) {
  const path = join(outDir, file);
  const source = await Bun.file(path).text();
  const rewritten = source.replace(aliasPattern, (_, quote, target) => {
    const rel = relative(dirname(path), join(outDir, target));
    return `${quote}${rel.startsWith(".") ? rel : `./${rel}`}.js${quote}`;
  });
  await Bun.write(path, rewritten);
}

const clientPkg = {
  name: "@arthurzakharov/iusta-connector-client",
  version,
  description: "Typed API client for iusta-connector",
  type: "module",
  main: "./client.js",
  types: "./client.d.ts",
  exports: {
    ".": { types: "./client.d.ts", import: "./client.js" },
  },
  sideEffects: false,
  peerDependencies: { hono: rootPkg.dependencies.hono },
  repository: {
    type: "git",
    url: "git+https://github.com/arthurzakharov/iusta-connector.git",
  },
  publishConfig: { registry: "https://npm.pkg.github.com" },
};
await Bun.write(
  join(outDir, "package.json"),
  `${JSON.stringify(clientPkg, null, 2)}\n`,
);

console.log(`Built ${clientPkg.name}@${version} in ${relative(root, outDir)}/`);
