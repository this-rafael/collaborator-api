#!/usr/bin/env node
/**
 * Mandatory seed + mixed read load for OpenTelemetry evidence.
 *
 * Usage:
 *   BASE_URL=http://localhost:3010 node scripts/otel-load.mjs
 *
 * Env overrides:
 *   BASE_URL   default http://localhost:3010
 *   DURATION_MS default 50000
 *   CONCURRENCY default 15
 */

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3010").replace(/\/$/, "");
const DURATION_MS = Number(process.env.DURATION_MS ?? 50_000);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 15);
const HAL_ACCEPT = "application/hal+json";
const NONEXISTENT_ID = "000000000000000000000000";

const statusCounts = new Map();
let totalRequests = 0;

function bumpStatus(status) {
  statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  totalRequests += 1;
}

async function request(method, path, {body, accept} = {}) {
  const headers = {};
  if (accept) headers.Accept = accept;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers.Accept = accept ?? HAL_ACCEPT;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  let parsed = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
  } else {
    await response.text().catch(() => "");
  }

  return {
    status: response.status,
    body: parsed,
    ok: response.status >= 200 && response.status < 300
  };
}

function uniqueSeed() {
  const stamp = Date.now().toString().slice(-9);
  const cpf = `1${stamp}`.padStart(11, "0").slice(0, 11);
  return {
    collaborator: {
      name: `OTel Load ${stamp}`,
      cpf,
      email: `otel-load-${stamp}@example.com`
    },
    documentType: {
      name: `OTel Load Type ${stamp}`,
      code: `OTEL_${stamp}`,
      description: "Seeded by otel-load.mjs"
    }
  };
}

async function seed() {
  const payloads = uniqueSeed();
  console.log(`Seeding against ${BASE_URL}`);
  console.log("Collaborator payload:", JSON.stringify(payloads.collaborator));
  console.log("Document-type payload:", JSON.stringify(payloads.documentType));

  const collaborator = await request("POST", "/api/v1/collaborators", {
    body: payloads.collaborator,
    accept: HAL_ACCEPT
  });
  bumpStatus(collaborator.status);
  if (!collaborator.ok) {
    throw new Error(
      `Seed collaborator failed: HTTP ${collaborator.status} ${JSON.stringify(collaborator.body)}`
    );
  }

  const documentType = await request("POST", "/api/v1/document-types", {
    body: payloads.documentType,
    accept: HAL_ACCEPT
  });
  bumpStatus(documentType.status);
  if (!documentType.ok) {
    throw new Error(
      `Seed document-type failed: HTTP ${documentType.status} ${JSON.stringify(documentType.body)}`
    );
  }

  const collaboratorId = collaborator.body?.id;
  const documentTypeId = documentType.body?.id;
  if (typeof collaboratorId !== "string" || typeof documentTypeId !== "string") {
    throw new Error(
      `Seed responses missing id: collaborator=${JSON.stringify(collaborator.body)} documentType=${JSON.stringify(documentType.body)}`
    );
  }

  return {collaboratorId, documentTypeId};
}

function pickPath(ids) {
  const roll = Math.random();
  // ~8% intentional 404s for error-rate signal
  if (roll < 0.04) return `/api/v1/collaborators/${NONEXISTENT_ID}`;
  if (roll < 0.08) return `/api/v1/document-types/${NONEXISTENT_ID}`;

  const routes = [
    "/health/live",
    "/health/ready",
    "/api/v1",
    "/api/v1/collaborators",
    "/api/v1/document-types",
    `/api/v1/collaborators/${ids.collaboratorId}`,
    `/api/v1/document-types/${ids.documentTypeId}`
  ];
  return routes[Math.floor(Math.random() * routes.length)];
}

function needsHal(path) {
  return path.startsWith("/api/");
}

async function worker(ids, deadline) {
  while (Date.now() < deadline) {
    const path = pickPath(ids);
    try {
      const result = await request("GET", path, {
        accept: needsHal(path) ? HAL_ACCEPT : undefined
      });
      bumpStatus(result.status);
    } catch (error) {
      bumpStatus("ERR");
      console.error(`Request failed ${path}:`, error instanceof Error ? error.message : error);
    }
  }
}

function printSummary(ids, elapsedMs) {
  const seconds = elapsedMs / 1000;
  const rps = seconds > 0 ? (totalRequests / seconds).toFixed(2) : "0";
  const distribution = [...statusCounts.entries()]
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([status, count]) => `${status}:${count}`)
    .join(" ");

  console.log("--- otel-load summary ---");
  console.log(`seed collaboratorId=${ids.collaboratorId}`);
  console.log(`seed documentTypeId=${ids.documentTypeId}`);
  console.log(`totalRequests=${totalRequests}`);
  console.log(`durationSec=${seconds.toFixed(2)}`);
  console.log(`rps=${rps}`);
  console.log(`statusDistribution ${distribution}`);
}

async function main() {
  if (!Number.isFinite(DURATION_MS) || DURATION_MS <= 0) {
    throw new Error(`Invalid DURATION_MS: ${process.env.DURATION_MS}`);
  }
  if (!Number.isFinite(CONCURRENCY) || CONCURRENCY < 1) {
    throw new Error(`Invalid CONCURRENCY: ${process.env.CONCURRENCY}`);
  }

  const ids = await seed();
  console.log(`Seed OK collaboratorId=${ids.collaboratorId} documentTypeId=${ids.documentTypeId}`);
  console.log(`Load phase: durationMs=${DURATION_MS} concurrency=${CONCURRENCY}`);

  const started = Date.now();
  const deadline = started + DURATION_MS;
  await Promise.all(Array.from({length: CONCURRENCY}, () => worker(ids, deadline)));
  printSummary(ids, Date.now() - started);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
