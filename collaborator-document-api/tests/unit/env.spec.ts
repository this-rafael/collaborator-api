import {describe, expect, it} from "vitest";

import {EnvironmentValidationError, loadEnv} from "../../src/config/env.js";

const validEnv = {
  NODE_ENV: "test",
  PORT: "3000",
  MONGODB_URI: "mongodb://localhost:27017/test?replicaSet=rs0",
  CURSOR_HMAC_SECRET: "test-cursor-secret-must-be-at-least-32-bytes",
  LOG_LEVEL: "debug"
};

describe("Environment configuration", () => {
  it("validates a complete environment", () => {
    expect(loadEnv(validEnv)).toEqual({
      nodeEnv: "test",
      port: 3000,
      mongodbUri: validEnv.MONGODB_URI,
      cursorHmacSecret: validEnv.CURSOR_HMAC_SECRET,
      logLevel: "debug",
      cors: {allowlist: []},
      rateLimit: {readLimit: 60, writeLimit: 20, windowMs: 60000},
      openapi: {path: "/openapi.json", specVersion: "3.1.0"}
    });
  });

  it("reports every missing required value without exposing values", () => {
    expect(() => loadEnv({})).toThrow(EnvironmentValidationError);
    expect(() => loadEnv({})).toThrow(/NODE_ENV.*PORT.*MONGODB_URI.*CURSOR_HMAC_SECRET.*LOG_LEVEL/);
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
    expect(() => loadEnv({...validEnv, RATE_LIMIT_WRITE: "not-a-number"})).toThrow(
      "RATE_LIMIT_WRITE must be a non-negative integer"
    );
    expect(() => loadEnv({...validEnv, RATE_LIMIT_WINDOW_MS: "999"})).toThrow(
      "RATE_LIMIT_WINDOW_MS must be at least 1000"
    );
  });

  it("rejects a short CURSOR_HMAC_SECRET", () => {
    expect(() => loadEnv({...validEnv, CURSOR_HMAC_SECRET: "too-short"})).toThrow(
      "CURSOR_HMAC_SECRET must contain at least 32 bytes"
    );
  });

  it("splits and trims CORS_ALLOWLIST origins", () => {
    expect(
      loadEnv({
        ...validEnv,
        CORS_ALLOWLIST: " https://a.example ,https://b.example, , "
      }).cors.allowlist
    ).toEqual(["https://a.example", "https://b.example"]);
  });

  it("rejects bad MongoDB protocol and missing database name", () => {
    expect(() => loadEnv({...validEnv, MONGODB_URI: "http://localhost/test"})).toThrow(
      "MONGODB_URI must use mongodb or mongodb+srv"
    );
    expect(() =>
      loadEnv({...validEnv, MONGODB_URI: "mongodb://localhost:27017/?replicaSet=rs0"})
    ).toThrow("MONGODB_URI must include a database name");
  });
});
