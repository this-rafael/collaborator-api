import {afterEach, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";
import supertest from "supertest";

import {bootstrapHttpMongo} from "../helpers/http-mongo.js";

describe("Health HTTP smoke", () => {
  bootstrapHttpMongo();

  afterEach(() => {
    delete process.env.HEALTH_TEST_READINESS;
  });

  it("boots Ts.ED and exposes the liveness endpoint", async () => {
    const response = await supertest(PlatformTest.callback()).get("/health/live").expect(200);
    expect(response.body).toEqual({status: "ok"});
    expect(response.headers["content-type"]).toContain("application/json");
  });

  it("returns 200 when Mongo readiness succeeds", async () => {
    const response = await supertest(PlatformTest.callback()).get("/health/ready").expect(200);
    expect(response.body).toEqual({status: "ok"});
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
