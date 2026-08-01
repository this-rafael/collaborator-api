import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(repositoryRoot, "_site");
const requiredFiles = [
  ".nojekyll",
  "index.html",
  "en/index.html",
  "assets/styles.css",
  "assets/favicon.svg",
  "reference/index.html",
  "openapi/index.html",
  "openapi/openapi.yaml",
  "architecture/index.html",
  "architecture/knowledge-graph.json",
  "architecture/meta.json",
  "architecture/config.json",
  "architecture/fingerprints.json",
  "architecture/diff-overlay.json",
  "architecture/domain-graph.json",
];

const missing = [];
for (const relativePath of requiredFiles) {
  try {
    const file = await stat(join(outputRoot, relativePath));
    if (!file.isFile()) missing.push(relativePath);
  } catch {
    missing.push(relativePath);
  }
}

if (missing.length > 0) {
  throw new Error(`Missing portal files: ${missing.join(", ")}`);
}

async function listTextFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listTextFiles(path)));
    else if (
      [".html", ".json", ".yaml", ".yml", ".svg", ".css"].includes(
        extname(path),
      )
    ) {
      files.push(path);
    }
  }
  return files;
}

const unsafeFiles = [];
for (const path of await listTextFiles(outputRoot)) {
  const contents = await readFile(path, "utf8");
  if (/\/home\/|\/Users\/|[A-Za-z]:\\\\/.test(contents)) {
    unsafeFiles.push(relative(outputRoot, path));
  }
}
if (unsafeFiles.length > 0) {
  throw new Error(
    `Published files contain absolute local paths: ${unsafeFiles.join(", ")}`,
  );
}

const architectureIndex = await readFile(
  join(outputRoot, "architecture", "index.html"),
  "utf8",
);
if (!architectureIndex.includes("./assets/")) {
  throw new Error("Architecture viewer does not use portable relative assets.");
}

const openApiIndex = await readFile(
  join(outputRoot, "openapi", "index.html"),
  "utf8",
);
if (
  openApiIndex.includes("Redoc.hydrate(__redoc_state, container);") ||
  !openApiIndex.includes("container.replaceChildren();") ||
  !openApiIndex.includes("../assets/favicon.svg")
) {
  throw new Error("OpenAPI docs lack client rendering or the shared favicon.");
}

const graph = JSON.parse(
  await readFile(
    join(outputRoot, "architecture", "knowledge-graph.json"),
    "utf8",
  ),
);
if (
  !Array.isArray(graph.nodes) ||
  graph.nodes.length === 0 ||
  !Array.isArray(graph.edges) ||
  graph.edges.length === 0
) {
  throw new Error("Published knowledge graph is empty or malformed.");
}

const config = JSON.parse(
  await readFile(join(outputRoot, "architecture", "config.json"), "utf8"),
);
if (!String(config.outputLanguage ?? "").startsWith("pt")) {
  throw new Error(
    "Architecture graph must preserve its Portuguese configuration.",
  );
}

console.log(
  `Portal valid: OpenAPI, TypeDoc and architecture (${String(graph.nodes.length)} nodes, ${String(graph.edges.length)} edges).`,
);
