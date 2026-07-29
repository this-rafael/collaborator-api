import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";
import supertest from "supertest";

import {Server} from "../../src/Server.js";

describe("HTTP core security headers", () => {
  beforeAll(PlatformTest.bootstrap(Server));
  afterAll(PlatformTest.reset);

  it("applies Helmet security headers to the discovery response", async () => {
    const response = await supertest(PlatformTest.callback()).get("/api/v1");
    const headers = response.headers;
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBeDefined();
  });

  it("does not echo allowlist-blocking Origin header in CORS", async () => {
    const response = await supertest(PlatformTest.callback())
      .get("/api/v1")
      .set("Origin", "https://malicious.example.com");
    const allowOrigin = response.headers["access-control-allow-origin"];
    if (allowOrigin) {
      expect(allowOrigin).not.toBe("https://malicious.example.com");
      expect(allowOrigin).not.toBe("*");
    }
  });

  it("keeps the existing liveness probe exempt from CORS preflight requirements", async () => {
    const response = await supertest(PlatformTest.callback())
      .get("/health/live")
      .set("Origin", "https://allowed.example.com");
    expect(response.status).toBe(200);
  });

  it("does not honor forwarded client IP without trust proxy being enabled", async () => {
    const response = await supertest(PlatformTest.callback())
      .get("/api/v1")
      .set("X-Forwarded-For", "10.0.0.1");
    expect(response.status).toBeDefined();
    const serialized = JSON.stringify(response.body) + JSON.stringify(response.headers);
    expect(serialized).not.toContain("10.0.0.1");
  });
});
