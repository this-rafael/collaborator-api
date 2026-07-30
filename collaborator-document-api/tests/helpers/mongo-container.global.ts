import {existsSync} from "node:fs";
import {join} from "node:path";
import type {TestProject} from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

const STOP_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
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

  console.info("[mongo-container] starting MongoDBContainer mongo:7.0.37");
  const {MongoDBContainer} = await import("@testcontainers/mongodb");
  const container = await new MongoDBContainer("mongo:7.0.37").start();
  const uri = new URL(container.getConnectionString());
  uri.pathname = "/collaborator_document_test";
  uri.searchParams.set("replicaSet", "rs0");
  uri.searchParams.set("directConnection", "true");
  project.provide("mongoUri", uri.toString());
  console.info("[mongo-container] ready", uri.toString().replace(/\/\/.*@/, "//"));

  return async () => {
    console.info("[mongo-container] stopping container");
    try {
      await withTimeout(container.stop(), STOP_TIMEOUT_MS, "MongoDBContainer.stop()");
    } finally {
      console.info("[mongo-container] stop finished");
    }
  };
}
