const host = process.env.SONAR_HOST_URL ?? "http://localhost:9000";
const statusUrl = `${host.replace(/\/$/, "")}/api/system/status`;
const timeoutMs = Number(process.env.SONAR_WAIT_TIMEOUT_MS ?? 180_000);
const intervalMs = Number(process.env.SONAR_WAIT_INTERVAL_MS ?? 3_000);
const deadline = Date.now() + timeoutMs;

async function isUp() {
  try {
    const response = await fetch(statusUrl);
    if (!response.ok) return false;
    const body = await response.json();
    return body?.status === "UP";
  } catch {
    return false;
  }
}

while (Date.now() < deadline) {
  if (await isUp()) {
    process.stdout.write(`SonarQube is UP at ${host}\n`);
    process.exit(0);
  }
  process.stdout.write(`Waiting for SonarQube at ${statusUrl}...\n`);
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}

process.stderr.write(`SonarQube did not become UP within ${timeoutMs}ms (${statusUrl})\n`);
process.exit(1);
