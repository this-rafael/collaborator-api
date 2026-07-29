import {afterAll, afterEach, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";
import supertest from "supertest";

import mongoose from "mongoose";

import {Server} from "../../src/Server.js";
import {maskSensitive} from "../../src/shared/presentation/http/middlewares/request-observability.middleware.js";
import {assertNoInternalLeak} from "../helpers/health-runtime.js";
import {healthProblemDetailsFixture} from "../helpers/health-fixtures.js";

beforeAll(() => {
  process.env.NODE_ENV = "test";
  return PlatformTest.bootstrap(Server)();
});
afterAll(async () => {
  await PlatformTest.reset();
  delete process.env.NODE_ENV;
});
afterEach(() => {
  delete process.env.HEALTH_TEST_READINESS;
});

describe("FND-HTTP", () => {
  it("FND-HTTP-001 boots Ts.ED and exposes the smoke endpoint", async () => {
    const response = await supertest(PlatformTest.callback()).get("/health/live").expect(200);
    expect(response.body).toEqual({status: "ok"});
    expect(response.headers["content-type"]).toContain("application/json");
  });
});

describe("Operational health checks (HEALTH-LIVE-001 / HEALTH-READY-001..003)", () => {
  it("HEALTH-LIVE-001 returns 200 JSON, ok body, and no HAL/ETag/rate-limit", async () => {
    const response = await supertest(PlatformTest.callback()).get("/health/live").expect(200);

    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({status: "ok"});
    expect(Object.keys(response.body)).toEqual(["status"]);
    expect(response.body._links).toBeUndefined();
    expect(response.headers.etag).toBeUndefined();
    expect(response.headers["retry-after"]).toBeUndefined();
    expect(response.status).not.toBe(429);
  });

  it("liveness stays 200 even when readiness is forced unavailable (no Mongo dependency)", async () => {
    process.env.HEALTH_TEST_READINESS = "unavailable";
    const response = await supertest(PlatformTest.callback()).get("/health/live").expect(200);
    expect(response.body).toEqual({status: "ok"});
  });

  it("HEALTH-READY-001 returns 200 JSON ok body without HAL/ETag when ready", async () => {
    process.env.HEALTH_TEST_READINESS = "available";
    const response = await supertest(PlatformTest.callback()).get("/health/ready").expect(200);

    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({status: "ok"});
    expect(Object.keys(response.body)).toEqual(["status"]);
    expect(response.body._links).toBeUndefined();
    expect(response.headers.etag).toBeUndefined();
    expect(response.headers["retry-after"]).toBeUndefined();
  });

  it("HEALTH-READY-002 returns 503 Problem Details with full sanitized payload", async () => {
    process.env.HEALTH_TEST_READINESS = "unavailable";
    const response = await supertest(PlatformTest.callback()).get("/health/ready").expect(503);

    expect(response.headers["content-type"]).toContain("application/problem+json");

    const body = response.body as ReturnType<typeof healthProblemDetailsFixture>;
    expect(body.status).toBe(503);
    expect(body.code).toBe("SERVICE_UNAVAILABLE");
    expect(body.instance).toBe("/health/ready");
    expect(typeof body.traceId).toBe("string");
    expect(body.traceId.length).toBeGreaterThan(0);
    for (const field of [
      "type",
      "title",
      "status",
      "detail",
      "instance",
      "code",
      "traceId"
    ] as const) {
      expect(body).toHaveProperty(field);
    }
  });

  it("HEALTH-READY-003 rejects URI, user, password, query, driver message and stack in the body", async () => {
    process.env.HEALTH_TEST_READINESS = "unavailable";
    const response = await supertest(PlatformTest.callback()).get("/health/ready").expect(503);

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(/mongodb:\/\//i);
    expect(serialized).not.toMatch(/super-secret-password/i);
    expect(serialized).not.toMatch(/admin@db\.example\.com/i);
    expect(serialized).not.toMatch(/retryWrites=true/i);
    expect(serialized).not.toMatch(/MongoServerSelectionError/i);
    expect(serialized).not.toMatch(/ECONNREFUSED/i);
    expect(serialized).not.toMatch(/node_modules/i);
    expect(serialized).not.toMatch(/\.ts:\d+/);
    assertNoInternalLeak(serialized);
  });
});

describe("Health observability masking (HEALTH-LIVE-001 related)", () => {
  it("masks CPF and email patterns in any logged context", () => {
    const masked = maskSensitive("cpf 123.456.789-09 email a@b.com");
    expect(masked).not.toContain("123.456.789-09");
    expect(masked).not.toContain("a@b.com");
    expect(masked).toContain("***");
  });

  it("does not leak CPF or email from the request into response or observability headers", async () => {
    const response = await supertest(PlatformTest.callback())
      .get("/health/live?cpf=123.456.789-09&email=a@b.com")
      .expect(200);

    const serialized = JSON.stringify(response.body) + JSON.stringify(response.headers);
    expect(serialized).not.toContain("123.456.789-09");
    expect(serialized).not.toContain("a@b.com");
    expect(response.headers["x-observability-route"]).toBe("/health/live");
  });
});

describe("Health controller real readiness path (no test-only override)", () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
    const conn = mongoose.connection as unknown as {readyState: number; db?: unknown};
    conn.readyState = 0;
    conn.db = undefined;
  });

  it("returns 503 via the real readiness path when MongoDB is unavailable", async () => {
    process.env.NODE_ENV = "production";
    const response = await supertest(PlatformTest.callback()).get("/health/ready").expect(503);
    expect(response.body.code).toBe("SERVICE_UNAVAILABLE");
    expect(response.body.instance).toBe("/health/ready");
  });

  it("returns 200 via the real readiness path when MongoDB is connected", async () => {
    process.env.NODE_ENV = "production";
    const conn = mongoose.connection as unknown as {
      readyState: number;
      db: {admin: () => {ping: () => Promise<{ok: number}>}};
    };
    conn.readyState = 1;
    conn.db = {admin: () => ({ping: () => Promise.resolve({ok: 1})})};
    const response = await supertest(PlatformTest.callback()).get("/health/ready").expect(200);
    expect(response.body).toEqual({status: "ok"});
  });
});
