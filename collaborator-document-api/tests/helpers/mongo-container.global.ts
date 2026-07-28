import {existsSync} from "node:fs";
import {join} from "node:path";
import type {TestProject} from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

export async function setup(project: TestProject) {
  const podmanSocket = process.env.XDG_RUNTIME_DIR
    ? join(process.env.XDG_RUNTIME_DIR, "podman", "podman.sock")
    : undefined;
  if (podmanSocket && existsSync(podmanSocket)) {
    process.env.DOCKER_HOST ??= `unix://${podmanSocket}`;
    if (process.env.DOCKER_HOST.includes("podman.sock")) {
      process.env.TESTCONTAINERS_RYUK_DISABLED ??= "true";
    }
  }

  const {MongoDBContainer} = await import("@testcontainers/mongodb");
  const container = await new MongoDBContainer("mongo:7.0.37").start();
  const uri = new URL(container.getConnectionString());
  uri.pathname = "/collaborator_document_test";
  uri.searchParams.set("replicaSet", "rs0");
  uri.searchParams.set("directConnection", "true");
  project.provide("mongoUri", uri.toString());

  return async () => {
    await container.stop();
  };
}
