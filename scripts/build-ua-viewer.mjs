import {
  cp,
  mkdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cacheRoot = join(repositoryRoot, ".cache", "understand-anything-v2.9.2");
const dashboardRoot = join(cacheRoot, "packages", "dashboard");
const dashboardPublic = join(dashboardRoot, "public");
const outputRoot = join(repositoryRoot, "_site", "architecture");
const graphRoot = join(repositoryRoot, ".ua");
const corepackBin = join(cacheRoot, ".corepack-bin");
const expectedCommit = "092feec79f6f7c78d95c9c55087fb48fa1178c99";
const repositoryUrl = "https://github.com/Egonex-AI/Understand-Anything.git";
const installedSource = join(
  homedir(),
  ".understand-anything",
  "repo",
  "understand-anything-plugin",
);
const pagesBase = "./";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    env: { ...process.env, ...options.env },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${String(result.status)}`);
  }
}

function gitHead(directory) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: directory,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : undefined;
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
  const localSourceMatches =
    (await exists(join(installedSource, "package.json"))) &&
    gitHead(installedSource) === expectedCommit;
  const markerPath = join(cacheRoot, ".source-commit");
  const marker = (await exists(markerPath))
    ? (await readFile(markerPath, "utf8")).trim()
    : undefined;

  if (
    (await exists(join(cacheRoot, "package.json"))) &&
    (gitHead(cacheRoot) === expectedCommit || marker === expectedCommit)
  ) {
    return localSourceMatches;
  }

  await rm(cacheRoot, { recursive: true, force: true });
  await mkdir(dirname(cacheRoot), { recursive: true });

  if (localSourceMatches) {
    await cp(installedSource, cacheRoot, {
      recursive: true,
      filter(source) {
        const segments = relative(installedSource, source).split(/[\\/]/);
        return !segments.includes(".git") && !segments.includes("node_modules");
      },
    });
    await writeFile(markerPath, `${expectedCommit}\n`);
    return true;
  }

  run("git", ["clone", "--quiet", repositoryUrl, cacheRoot]);
  run("git", ["checkout", "--quiet", "--detach", expectedCommit], {
    cwd: cacheRoot,
  });
  return false;
}

async function linkInstalledDependencies() {
  const rootDependencies = join(cacheRoot, "node_modules");
  await rm(rootDependencies, { recursive: true, force: true });
  await symlink(join(installedSource, "node_modules"), rootDependencies, "dir");

  for (const relativePath of [
    join("packages", "core", "node_modules"),
    join("packages", "dashboard", "node_modules"),
  ]) {
    const target = join(cacheRoot, relativePath);
    await rm(target, { recursive: true, force: true });
    await mkdir(dirname(target), { recursive: true });
    await cp(join(installedSource, relativePath), target, {
      recursive: true,
      verbatimSymlinks: true,
    });
  }
  await mkdir(join(dashboardRoot, "node_modules", ".tmp"), { recursive: true });
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

const canReuseInstalledDependencies = await ensurePinnedSource();
if (canReuseInstalledDependencies) {
  await linkInstalledDependencies();
  run(join(cacheRoot, "node_modules", ".bin", "tsc"), [], {
    cwd: join(cacheRoot, "packages", "core"),
  });
  await copyGraphInputs();
  run(join(cacheRoot, "node_modules", ".bin", "tsc"), ["-b"], {
    cwd: dashboardRoot,
  });
  run(
    join(dashboardRoot, "node_modules", ".bin", "vite"),
    ["build", "--config", "vite.config.demo.ts", `--base=${pagesBase}`],
    { cwd: dashboardRoot },
  );
} else {
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
}

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
