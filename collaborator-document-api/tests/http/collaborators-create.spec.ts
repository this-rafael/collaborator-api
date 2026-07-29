import {beforeEach, describe, expect, it} from "vitest";
import supertest from "supertest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {resetDatabase} from "../helpers/database.js";
import {bootstrapHttpMongo, httpDatabase} from "../helpers/http-mongo.js";

describe("Creating collaborators", () => {
  bootstrapHttpMongo();
  beforeEach(async () => resetDatabase(httpDatabase()));

  it("creates an active collaborator with HAL headers", async () => {
    const response = await supertest(PlatformTest.callback())
      .post("/api/v1/collaborators")
      .send(valid())
      .expect(201);
    expect(response.headers.location).toMatch(/^\/api\/v1\/collaborators\/[a-f0-9]{24}$/);
    expect(response.body.deletedAt).toBeNull();
  });

  it("validates input and maps duplicate active identifiers", async () => {
    await supertest(PlatformTest.callback())
      .post("/api/v1/collaborators")
      .send({name: ""})
      .expect(422);
    await supertest(PlatformTest.callback())
      .post("/api/v1/collaborators")
      .send(valid())
      .expect(201);
    const duplicate = await supertest(PlatformTest.callback())
      .post("/api/v1/collaborators")
      .send(valid())
      .expect(409);
    expect(duplicate.body.code).toBe("DUPLICATE_ACTIVE_CPF");
  });
});

function valid() {
  return {name: "Ana Silva", cpf: "12345678909", email: "ana@example.com"};
}
