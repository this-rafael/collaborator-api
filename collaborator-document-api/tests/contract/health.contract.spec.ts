import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";
import supertest from "supertest";

import {Server} from "../../src/Server.js";

describe("FND-CONTRACT", () => {
  beforeAll(PlatformTest.bootstrap(Server));
  afterAll(PlatformTest.reset);

  it("FND-CONTRACT-001 preserves the minimum health representation", async () => {
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
    expect(openApi.paths?.["/health/live"]?.get?.operationId).toBe("live");
  });
});
