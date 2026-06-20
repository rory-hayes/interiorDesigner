import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pnpmDir = join(root, "node_modules", ".pnpm");
const pnpmEsbuild =
  existsSync(pnpmDir) ?
    readdirSync(pnpmDir)
      .filter((entry) => entry.startsWith("esbuild@"))
      .sort()
      .map((entry) => join(pnpmDir, entry, "node_modules", "esbuild", "bin", "esbuild"))
      .find((candidate) => existsSync(candidate))
  : undefined;
const esbuildBin =
  [
    join(root, "node_modules", ".bin", "esbuild"),
    join(root, "node_modules", "esbuild", "bin", "esbuild"),
    pnpmEsbuild,
  ].find((candidate) => candidate && existsSync(candidate)) ?? "";
const viteBin = join(root, "node_modules", "vite", "bin", "vite.js");
const bundledApi = join("/private/tmp", "roomwise-api.cjs");

for (const requiredBin of [esbuildBin, viteBin]) {
  if (!existsSync(requiredBin)) {
    console.error(`Missing ${requiredBin}. Run npm install before starting Roomwise.`);
    process.exit(1);
  }
}

const apiBuild = spawnSync(
  esbuildBin,
  [
    "server/index.ts",
    "--bundle",
    "--platform=node",
    "--format=cjs",
    `--outfile=${bundledApi}`,
  ],
  {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      TMPDIR: process.env.TMPDIR?.startsWith("/private/") ? process.env.TMPDIR : "/private/tmp",
    },
  },
);

if (apiBuild.status !== 0) {
  process.stderr.write(apiBuild.stderr);
  process.exit(apiBuild.status ?? 1);
}

const processes = [
  ["api", process.execPath, [bundledApi]],
  ["web", process.execPath, [viteBin, "--host", "127.0.0.1", "--port", "5173"]],
];

const children = processes.map(([name, command, args]) => {
  const child = spawn(command, args, {
    env: {
      ...process.env,
      TMPDIR: process.env.TMPDIR?.startsWith("/private/") ? process.env.TMPDIR : "/private/tmp",
    },
    stdio: ["inherit", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown();
    }
  });

  return child;
});

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(143);
});
