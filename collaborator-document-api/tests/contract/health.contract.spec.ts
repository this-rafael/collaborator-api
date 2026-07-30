import {afterAll, afterEach, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";
import supertest from "supertest";

import {Server} from "../../src/Server.js";
import {contractServerSettings} from "./collaborators-contract.helpers.js";

describe("Health contract minimum", () => {
  beforeAll(PlatformTest.bootstrap(Server, contractServerSettings));
  afterAll(PlatformTest.reset);

  afterEach(() => {
    delete process.env.HEALTH_TEST_READINESS;
  });

  it("preserves the minimum health representation", async () => {
    const response = await supertest(PlatformTest.callback()).get("/health/live").expect(200);
    expect(response.body).toStrictEqual({status: "ok"});
    expect(Object.keys(response.body)).toEqual(["status"]);
  });

  it("publishes the liveness route in the OpenAPI document", async () => {
    const response = await supertest(PlatformTest.callback()).get("/openapi.json").expect(200);
    const openApi = response.body as {
      paths?: Record<string, {get?: {operationId?: string}}>;
    };

    expect(openApi.paths?.["/health/live"]?.get).toBeDefined();
    expect(openApi.paths?.["/health/live"]?.get?.operationId).toBe("getLiveness");
  });

  it("publishes the readiness route in the OpenAPI document", async () => {
    const response = await supertest(PlatformTest.callback()).get("/openapi.json").expect(200);
    const openApi = response.body as {
      paths?: Record<string, {get?: {operationId?: string}}>;
    };

    expect(openApi.paths?.["/health/ready"]?.get).toBeDefined();
    expect(openApi.paths?.["/health/ready"]?.get?.operationId).toBe("getReadiness");
  });

  it("returns 200 when readiness is forced available", async () => {
    process.env.HEALTH_TEST_READINESS = "available";

    const response = await supertest(PlatformTest.callback()).get("/health/ready").expect(200);
    expect(response.body).toStrictEqual({status: "ok"});
    expect(response.headers["content-type"]).toContain("application/json");
  });

  it("returns 503 problem+json when readiness is forced unavailable", async () => {
    process.env.HEALTH_TEST_READINESS = "unavailable";

    const response = await supertest(PlatformTest.callback()).get("/health/ready").expect(503);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body).toMatchObject({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      instance: "/health/ready"
    });
    expect(typeof response.body.traceId).toBe("string");
    expect(response.body.traceId.length).toBeGreaterThan(0);
  });
});
