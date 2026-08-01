import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readRootPackageJson() {
  try {
    return JSON.parse(
      await readFile(join(repositoryRoot, "package.json"), "utf8"),
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function assertRegularFile(relativePath) {
  try {
    const file = await stat(join(repositoryRoot, relativePath));
    assert.equal(file.isFile(), true, `${relativePath} must be a regular file`);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      assert.fail(`${relativePath} must exist`);
    }

    throw error;
  }
}

async function assertPackageScript(scriptName) {
  const packageJson = await readRootPackageJson();
  const script = packageJson?.scripts?.[scriptName];

  assert.equal(
    typeof script === "string" && script.trim().length > 0,
    true,
    `root package.json must define scripts.${scriptName}`,
  );
}

test("root package exposes docs:site", async () => {
  await assertPackageScript("docs:site");
});

test("root package exposes docs:site:check", async () => {
  await assertPackageScript("docs:site:check");
});

test("repository publishes its OpenAPI contract from the root", async () => {
  await assertRegularFile("openapi/openapi.yaml");
});

test("repository defines the GitHub Pages workflow", async () => {
  await assertRegularFile(".github/workflows/pages.yml");
});

test("docs:site:check produces the public portal sections", async (context) => {
  const packageJson = await readRootPackageJson();
  const checkScript = packageJson?.scripts?.["docs:site:check"];

  if (typeof checkScript !== "string" || checkScript.trim().length === 0) {
    context.skip("docs:site:check is not available yet");
    return;
  }

  const result = spawnSync("npm", ["run", "docs:site:check"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  const commandOutput = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n");

  assert.equal(
    result.status,
    0,
    `docs:site:check must pass${commandOutput ? `:\n${commandOutput}` : ""}`,
  );

  await Promise.all([
    assertRegularFile("_site/openapi/index.html"),
    assertRegularFile("_site/reference/index.html"),
    assertRegularFile("_site/architecture/index.html"),
  ]);
});
