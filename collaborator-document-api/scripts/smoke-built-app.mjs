import {spawn} from "node:child_process";
import {once} from "node:events";
import {existsSync} from "node:fs";
import {createServer} from "node:net";
import {join} from "node:path";

const podmanSocket = process.env.XDG_RUNTIME_DIR
  ? join(process.env.XDG_RUNTIME_DIR, "podman", "podman.sock")
  : undefined;
if (podmanSocket && existsSync(podmanSocket)) {
  process.env.DOCKER_HOST ??= `unix://${podmanSocket}`;
  if (process.env.DOCKER_HOST.includes("podman.sock"))
    process.env.TESTCONTAINERS_RYUK_DISABLED ??= "true";
}

const {MongoDBContainer} = await import("@testcontainers/mongodb");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        return reject(new Error("Unable to allocate a port"));
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

const container = await new MongoDBContainer("mongo:7.0.37").start();
const uri = new URL(container.getConnectionString());
uri.pathname = "/collaborator_document_smoke";
uri.searchParams.set("replicaSet", "rs0");
uri.searchParams.set("directConnection", "true");
const port = await freePort();
const child = spawn(process.execPath, ["dist/index.js"], {
  env: {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(port),
    MONGODB_URI: uri.toString(),
    CURSOR_HMAC_SECRET: "smoke-test-cursor-secret-must-be-at-least-32-bytes",
    LOG_LEVEL: "error"
  },
  stdio: "ignore"
});

try {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health/live`);
      if (response.ok) break;
    } catch {
      // The process may still be binding the HTTP port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (attempt === 49) throw new Error("The compiled application did not become healthy");
  }
  child.kill("SIGTERM");
  await once(child, "exit");
} finally {
  if (!child.killed) child.kill("SIGKILL");
  await container.stop();
}
