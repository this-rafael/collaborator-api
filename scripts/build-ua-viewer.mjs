import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cacheRoot = join(repositoryRoot, ".cache", "understand-anything-v2.9.2");
const dashboardRoot = join(
  cacheRoot,
  "understand-anything-plugin",
  "packages",
  "dashboard",
);
const dashboardPublic = join(dashboardRoot, "public");
const outputRoot = join(repositoryRoot, "_site", "architecture");
const graphRoot = join(repositoryRoot, ".ua");
const corepackBin = join(cacheRoot, ".corepack-bin");
const expectedCommit = "092feec79f6f7c78d95c9c55087fb48fa1178c99";
const repositoryUrl = "https://github.com/Egonex-AI/Understand-Anything.git";
const pagesBase = "./";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    env: { ...process.env, ...options.env },
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${String(result.status)}`);
  }
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function ensurePinnedSource() {
  const packageManifest = join(cacheRoot, "package.json");

  if (await exists(packageManifest)) {
    const current = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: cacheRoot,
      encoding: "utf8",
    });

    if (current.status === 0 && current.stdout.trim() === expectedCommit) {
      return;
    }
  }

  await rm(cacheRoot, { recursive: true, force: true });
  await mkdir(cacheRoot, { recursive: true });

  run("git", ["init", "--quiet"], { cwd: cacheRoot });
  run("git", ["remote", "add", "origin", repositoryUrl], { cwd: cacheRoot });
  run("git", ["fetch", "--depth=1", "origin", expectedCommit], {
    cwd: cacheRoot,
  });
  run("git", ["checkout", "--quiet", "--detach", "FETCH_HEAD"], {
    cwd: cacheRoot,
  });
}

async function copyGraphInputs() {
  const requiredFiles = [
    "knowledge-graph.json",
    "meta.json",
    "config.json",
    "fingerprints.json",
    "diff-overlay.json",
  ];

  await mkdir(dashboardPublic, { recursive: true });

  for (const fileName of requiredFiles) {
    const source = join(graphRoot, fileName);
    if (!(await exists(source))) {
      throw new Error(`Missing Understand Anything artifact: ${source}`);
    }
    await cp(source, join(dashboardPublic, fileName));
  }

  await writeFile(join(dashboardPublic, "domain-graph.json"), "null\n");

  for (const fileName of requiredFiles) {
    const contents = await readFile(join(graphRoot, fileName), "utf8");
    if (/\/home\/|\/Users\/|[A-Za-z]:\\\\/.test(contents)) {
      throw new Error(`${fileName} contains an absolute local path.`);
    }
  }
}

async function buildViewer() {
  await mkdir(corepackBin, { recursive: true });
  run("corepack", ["enable", "--install-directory", corepackBin, "pnpm"], {
    cwd: cacheRoot,
  });

  const pnpmBinary = join(
    corepackBin,
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  );
  const pnpmEnvironment = {
    PATH: `${corepackBin}${delimiter}${process.env.PATH ?? ""}`,
  };

  run(pnpmBinary, ["install", "--frozen-lockfile"], {
    cwd: cacheRoot,
    env: pnpmEnvironment,
  });
  run(pnpmBinary, ["--filter", "@understand-anything/core", "build"], {
    cwd: cacheRoot,
    env: pnpmEnvironment,
  });

  await copyGraphInputs();

  run(pnpmBinary, ["run", "build:demo", `--base=${pagesBase}`], {
    cwd: dashboardRoot,
    env: pnpmEnvironment,
  });

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  await cp(join(dashboardRoot, "dist"), outputRoot, { recursive: true });

  const indexPath = join(outputRoot, "index.html");
  const indexHtml = await readFile(indexPath, "utf8");
  if (!indexHtml.includes("./assets/")) {
    throw new Error(
      "Architecture viewer was not built with portable relative assets.",
    );
  }

  await writeFile(join(outputRoot, ".nojekyll"), "");
}

await ensurePinnedSource();
await buildViewer();
