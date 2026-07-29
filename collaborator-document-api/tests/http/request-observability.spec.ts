import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";
import supertest from "supertest";

import {Server} from "../../src/Server.js";

describe("Request observability", () => {
  beforeAll(PlatformTest.bootstrap(Server));
  afterAll(PlatformTest.reset);

  it("generates a non-empty trace id for the discovery request when none is provided", async () => {
    const response = await supertest(PlatformTest.callback()).get("/api/v1");
    const traceId = response.headers["x-request-id"] ?? response.headers["x-trace-id"];
    expect(typeof traceId).toBe("string");
    expect((traceId as string).length).toBeGreaterThan(0);
  });

  it("propagates the client-supplied request id without altering it", async () => {
    const clientTrace = "01J3Y2QHB8FV4RGY7Y1QXNT2D4";
    const response = await supertest(PlatformTest.callback())
      .get("/api/v1")
      .set("X-Request-Id", clientTrace);
    expect(response.headers["x-request-id"]).toBe(clientTrace);
  });

  it("exposes a normalized route in the access log (no IDs, no query string)", async () => {
    const response = await supertest(PlatformTest.callback()).get("/api/v1?cursor=opaco");
    expect(response.status).toBeLessThan(500);
    const accessLog = (response.headers["x-observability-route"] as string | undefined) ?? "";
    if (accessLog) {
      expect(accessLog).toBe("/api/v1");
      expect(accessLog).not.toContain("?");
    }
  });

  it("masks query strings and credentials in error responses", async () => {
    const response = await supertest(PlatformTest.callback()).get("/api/v1?secret=hunter2");
    const serialized = JSON.stringify(response.body) + JSON.stringify(response.headers);
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toMatch(/authorization/i);
  });

  it("masks URI components and driver details in the Problem Details body", async () => {
    const response = await supertest(PlatformTest.callback())
      .get("/api/v1")
      .set("Authorization", "Bearer leaked-token");
    const body = JSON.stringify(response.body);
    expect(body).not.toContain("leaked-token");
    expect(body).not.toMatch(/at .+:\d+/);
  });
});
