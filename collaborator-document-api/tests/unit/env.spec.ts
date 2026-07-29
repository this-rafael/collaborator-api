import {describe, expect, it} from "vitest";

import {EnvironmentValidationError, loadEnv} from "../../src/config/env.js";

const validEnv = {
  NODE_ENV: "test",
  PORT: "3000",
  MONGODB_URI: "mongodb://localhost:27017/test?replicaSet=rs0",
  LOG_LEVEL: "debug"
};

describe("Environment configuration", () => {
  it("validates a complete environment", () => {
    expect(loadEnv(validEnv)).toEqual({
      nodeEnv: "test",
      port: 3000,
      mongodbUri: validEnv.MONGODB_URI,
      logLevel: "debug",
      cors: {allowlist: []},
      rateLimit: {limit: 60, windowMs: 60000},
      openapi: {path: "/openapi.json", specVersion: "3.1.0"}
    });
  });

  it("reports every missing required value without exposing values", () => {
    expect(() => loadEnv({})).toThrow(EnvironmentValidationError);
    expect(() => loadEnv({})).toThrow(/NODE_ENV.*PORT.*MONGODB_URI.*LOG_LEVEL/);
  });

  it("rejects invalid enums, port and non-replica URI", () => {
    expect(() =>
      loadEnv({
        ...validEnv,
        NODE_ENV: "local",
        PORT: "0",
        LOG_LEVEL: "trace",
        MONGODB_URI: "mongodb://localhost/db"
      })
    ).toThrow(/NODE_ENV.*PORT.*LOG_LEVEL.*replicaSet/);
  });

  it("accepts SRV and rejects malformed MongoDB addresses", () => {
    expect(
      loadEnv({...validEnv, MONGODB_URI: "mongodb+srv://cluster.example.com/test"}).mongodbUri
    ).toContain("mongodb+srv");
    expect(() => loadEnv({...validEnv, MONGODB_URI: "not a uri"})).toThrow(
      "MONGODB_URI must be a valid URI"
    );
  });

  it("rejects invalid rate limit configuration", () => {
    expect(() => loadEnv({...validEnv, RATE_LIMIT_GET: "not-a-number"})).toThrow(
      "RATE_LIMIT_GET must be a non-negative integer"
    );
    expect(() => loadEnv({...validEnv, RATE_LIMIT_WINDOW_MS: "999"})).toThrow(
      "RATE_LIMIT_WINDOW_MS must be at least 1000"
    );
  });
});
