import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";
import supertest from "supertest";

import {Server} from "../../src/Server.js";

describe("Health HTTP smoke", () => {
  beforeAll(PlatformTest.bootstrap(Server));
  afterAll(PlatformTest.reset);

  it("boots Ts.ED and exposes the liveness endpoint", async () => {
    const response = await supertest(PlatformTest.callback()).get("/health/live").expect(200);
    expect(response.body).toEqual({status: "ok"});
    expect(response.headers["content-type"]).toContain("application/json");
  });
});
