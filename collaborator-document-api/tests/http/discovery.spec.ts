import {afterAll, afterEach, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";
import supertest from "supertest";

import {
  apiRootAltVersionFixture,
  apiRootFixture,
  problemDetailsFixture,
  problemDetailsRateLimitFixture,
  problemDetailsServiceUnavailableFixture,
  requiredDiscoveryRelations,
  templatedDiscoveryRelations
} from "../helpers/discovery-fixtures.js";
import {bootstrapHttpMongo} from "../helpers/http-mongo.js";

interface ApiRootResponse {
  name: string;
  version: string;
  _links: Record<
    string,
    {href: string; templated?: boolean; method?: string; type?: string; title?: string}
  >;
}

const etagPattern = /^W\/"sha256:[a-f0-9]{64}"$/;

describe("Discovery slice", () => {
  bootstrapHttpMongo({
    beforeBootstrap: () => {
      process.env.NODE_ENV = "test";
      process.env.RATE_LIMIT_GET = "4";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
    }
  });
  afterEach(() => {
    delete process.env.DISCOVERY_TEST_FAILURE;
  });
  afterAll(() => {
    delete process.env.NODE_ENV;
    delete process.env.RATE_LIMIT_GET;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  it("returns 200 with HAL media type, semantic body and weak ETag", async () => {
    const response = await supertest(PlatformTest.callback())
      .get("/api/v1")
      .set("Accept", "application/hal+json")
      .expect(200);

    expect(response.headers["content-type"]).toContain("application/hal+json");
    const body = response.body as ApiRootResponse;
    expect(body.name).toBe("Collaborator Document API");
    expect(body.version).toBe("1");
    expect(body._links).toBeDefined();
    expect(Object.keys(body._links).sort()).toEqual([...requiredDiscoveryRelations].sort());

    const etag = response.headers.etag;
    expect(etag).toBeDefined();
    expect(etag).toMatch(etagPattern);
  });

  it("enforces that the nine required relations exist and only templated links advertise templated=true", () => {
    const links = apiRootFixture._links;
    for (const relation of requiredDiscoveryRelations) {
      const link = links[relation];
      expect(link).toBeDefined();
      expect(link?.href).toMatch(/^\/api\/v1/);
    }
    for (const relation of templatedDiscoveryRelations) {
      expect(links[relation]?.templated).toBe(true);
    }
    expect(links.self?.templated).toBeFalsy();
    expect(links.completeness?.templated).toBeFalsy();
  });

  it("returns 304 without body when If-None-Match matches the current ETag", async () => {
    const first = await supertest(PlatformTest.callback()).get("/api/v1").expect(200);
    const etag = first.headers.etag;
    expect(etag).toMatch(etagPattern);

    const second = await supertest(PlatformTest.callback())
      .get("/api/v1")
      .set("If-None-Match", etag as string)
      .expect(304);

    expect(second.headers["content-type"]).toBeUndefined();
    expect(second.text).toBe("");
    expect(second.body).toEqual({});
  });

  it("returns a new ETag and 200 body after a semantic change", async () => {
    const before = await supertest(PlatformTest.callback()).get("/api/v1").expect(200);
    const beforeEtag = before.headers.etag as string;
    const beforeBody = before.body as ApiRootResponse;

    const altFixture: ApiRootResponse = apiRootAltVersionFixture;
    expect(altFixture.version).not.toBe(beforeBody.version);

    expect(beforeEtag).toMatch(etagPattern);
  });

  it("returns 429 with RATE_LIMIT_EXCEEDED, full Problem Details and Retry-After", async () => {
    const response = await supertest(PlatformTest.callback()).get("/api/v1").expect(429);

    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.headers["retry-after"]).toBeDefined();
    const retryAfter = Number.parseInt(response.headers["retry-after"] as string, 10);
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);

    const body = response.body as ReturnType<typeof problemDetailsFixture>;
    expect(body.status).toBe(429);
    expect(body.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(body.title).toBe(problemDetailsRateLimitFixture().title);
    expect(body.type).toBe(problemDetailsRateLimitFixture().type);
    expect(body.detail).toBe(problemDetailsRateLimitFixture().detail);
    expect(body.instance).toBe("/api/v1");
    expect(typeof body.traceId).toBe("string");
    expect(body.traceId.length).toBeGreaterThan(0);
    for (const field of ["type", "title", "status", "detail", "instance", "code", "traceId"]) {
      expect(body).toHaveProperty(field);
    }
  });

  it("returns 500 sanitized with INTERNAL_SERVER_ERROR and traceId, no implementation details", async () => {
    process.env.DISCOVERY_TEST_FAILURE = "internal";
    const response = await supertest(PlatformTest.callback()).get("/api/v1").expect(500);

    expect(response.headers["content-type"]).toContain("application/problem+json");

    const body = response.body as ReturnType<typeof problemDetailsFixture>;
    expect(body.status).toBe(500);
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.title).toBe(problemDetailsFixture().title);
    expect(body.instance).toBe("/api/v1");
    expect(typeof body.traceId).toBe("string");
    expect(body.traceId.length).toBeGreaterThan(0);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/at \w+\.\w+ \(/);
    expect(serialized).not.toMatch(/node_modules/);
    expect(serialized).not.toMatch(/mongodb|mongoose/i);
    expect(serialized).not.toMatch(/\.ts:\d+/);
  });

  it("returns 503 sanitized with SERVICE_UNAVAILABLE and traceId, no internal details", async () => {
    process.env.DISCOVERY_TEST_FAILURE = "unavailable";
    const response = await supertest(PlatformTest.callback()).get("/api/v1").expect(503);

    expect(response.headers["content-type"]).toContain("application/problem+json");

    const body = response.body as ReturnType<typeof problemDetailsFixture>;
    expect(body.status).toBe(503);
    expect(body.code).toBe("SERVICE_UNAVAILABLE");
    expect(body.title).toBe(problemDetailsServiceUnavailableFixture().title);
    expect(body.instance).toBe("/api/v1");
    expect(typeof body.traceId).toBe("string");
    expect(body.traceId.length).toBeGreaterThan(0);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/at \w+\.\w+ \(/);
    expect(serialized).not.toMatch(/node_modules/);
    expect(serialized).not.toMatch(/\.ts:\d+/);
  });
});
