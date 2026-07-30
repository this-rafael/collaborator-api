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
    expect(response.headers["content-type"]).toContain("application/hal+json");
    expect(response.headers.location).toMatch(/^\/api\/v1\/collaborators\/[a-f0-9]{24}$/);
    expect(response.headers.etag).toMatch(/^W\/"sha256:[a-f0-9]{64}"$/);
    expect(response.body.id).toMatch(/^[a-f0-9]{24}$/);
    expect(response.body.deletedAt).toBeNull();
    expect(response.body._links).toMatchObject({
      self: {href: response.headers.location},
      collection: {href: "/api/v1/collaborators"},
      update: {method: "PATCH"},
      delete: {method: "DELETE"},
      documents: expect.anything(),
      "link-document": {method: "POST"}
    });
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
    expect(duplicate.headers["content-type"]).toContain("application/problem+json");
    expect(duplicate.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({field: "cpf", code: "DUPLICATE_ACTIVE_CPF"})
      ])
    );

    const duplicateEmail = await supertest(PlatformTest.callback())
      .post("/api/v1/collaborators")
      .send({...valid(), cpf: "98765432100"})
      .expect(409);
    expect(duplicateEmail.body.code).toBe("DUPLICATE_ACTIVE_EMAIL");
    expect(duplicateEmail.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({field: "email", code: "DUPLICATE_ACTIVE_EMAIL"})
      ])
    );
  });

  it("maps malformed JSON and unsupported media types to their published problems", async () => {
    const malformed = await supertest(PlatformTest.callback())
      .post("/api/v1/collaborators")
      .set("Content-Type", "application/json")
      .send('{"name":')
      .expect(400);
    expectProblem(malformed, "MALFORMED_JSON");

    const unsupported = await supertest(PlatformTest.callback())
      .post("/api/v1/collaborators")
      .set("Content-Type", "text/plain")
      .send("name=Ana")
      .expect(415);
    expectProblem(unsupported, "UNSUPPORTED_MEDIA_TYPE");
  });
});

function valid() {
  return {name: "Ana Silva", cpf: "12345678909", email: "ana@example.com"};
}

function expectProblem(
  response: {status: number; headers: Record<string, unknown>; body: Record<string, unknown>},
  code: string
) {
  expect(response.headers["content-type"]).toContain("application/problem+json");
  expect(response.body).toMatchObject({code, status: response.status});
  for (const field of ["type", "title", "detail", "instance", "traceId"]) {
    expect(response.body[field]).toBeDefined();
  }
}
