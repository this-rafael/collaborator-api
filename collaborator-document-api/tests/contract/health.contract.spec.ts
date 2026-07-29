import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";
import supertest from "supertest";

import {Server} from "../../src/Server.js";
import {
  loadHealthSliceFromContract,
  type JsonObject,
  type JsonValue
} from "../helpers/openapi-slice.js";

const isObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeRequired = (value: JsonValue | undefined): JsonValue =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.replace(/^-\s*/, "") : (item ?? null)))
    : (value ?? null);

const fetchPublishedOpenApi = async (): Promise<JsonObject> => {
  const candidates = ["/openapi.json", "/openapi.yaml", "/api/openapi.json", "/docs/openapi.json"];
  for (const path of candidates) {
    const response = await supertest(PlatformTest.callback())
      .get(path)
      .set("Accept", "application/json");
    if (response.status === 200 && response.body && typeof response.body === "object") {
      return response.body as JsonObject;
    }
  }
  throw new Error("OpenAPI document endpoint not exposed by the implementation");
};

const schemaRef = (response: JsonValue | undefined): string | undefined => {
  if (!isObject(response)) {
    return undefined;
  }
  const content = isObject(response.content) ? response.content : {};
  for (const media of Object.keys(content)) {
    const mediaObj = isObject(content[media]) ? content[media] : {};
    if (typeof mediaObj.schema === "object" && mediaObj.schema !== null) {
      const ref = (mediaObj.schema as JsonObject).$ref;
      if (typeof ref === "string") {
        return ref;
      }
    }
  }
  return undefined;
};

const mediaTypes = (response: JsonValue | undefined): string[] => {
  if (!isObject(response)) {
    return [];
  }
  return Object.keys(isObject(response.content) ? (response.content as JsonObject) : {});
};

const matchesConstOrEnum = (
  expectedProp: JsonValue | undefined,
  publishedProp: JsonValue | undefined
): boolean => {
  if (!isObject(expectedProp) || !isObject(publishedProp)) {
    return false;
  }
  const expectedConst = expectedProp.const;
  const expectedEnum = expectedProp.enum;
  const publishedConst = publishedProp.const;
  const publishedEnum = publishedProp.enum;
  if (typeof expectedConst === "string") {
    if (publishedConst === expectedConst) {
      return true;
    }
    if (Array.isArray(publishedEnum) && publishedEnum.includes(expectedConst)) {
      return true;
    }
  }
  if (Array.isArray(expectedEnum) && Array.isArray(publishedEnum)) {
    return expectedEnum.every((value) => publishedEnum.includes(value));
  }
  return expectedConst === undefined && expectedEnum === undefined;
};

describe("Published OpenAPI matches the operational health slice (SPEC-007)", () => {
  beforeAll(PlatformTest.bootstrap(Server));
  afterAll(PlatformTest.reset);

  it("HEALTH-LIVE-001 publishes getLiveness on /health/live with the HealthStatus schema", async () => {
    const published = await fetchPublishedOpenApi();
    expect(published.openapi).toMatch(/^3\./);

    const paths = isObject(published.paths) ? published.paths : {};
    const livePath = isObject(paths["/health/live"]) ? paths["/health/live"] : undefined;
    const live = isObject(livePath?.get) ? (livePath?.get as JsonObject) : undefined;
    expect(live).toBeDefined();
    expect(live?.operationId).toBe("getLiveness");
    expect(Array.isArray(live?.tags) ? live?.tags : []).toContain("Health");

    const response200 = isObject(live?.responses)
      ? (live?.responses as JsonObject)["200"]
      : undefined;
    expect(response200).toBeDefined();
    expect(mediaTypes(response200)).toContain("application/json");
    expect(schemaRef(response200)).toBe("#/components/schemas/HealthStatus");
  });

  it("HEALTH-READY-001 publishes getReadiness on /health/ready with 200 HealthStatus", async () => {
    const published = await fetchPublishedOpenApi();
    const paths = isObject(published.paths) ? published.paths : {};
    const readyPath = isObject(paths["/health/ready"]) ? paths["/health/ready"] : undefined;
    const ready = isObject(readyPath?.get) ? (readyPath?.get as JsonObject) : undefined;
    expect(ready).toBeDefined();
    expect(ready?.operationId).toBe("getReadiness");
    expect(Array.isArray(ready?.tags) ? ready?.tags : []).toContain("Health");

    const response200 = isObject(ready?.responses)
      ? (ready?.responses as JsonObject)["200"]
      : undefined;
    expect(response200).toBeDefined();
    expect(mediaTypes(response200)).toContain("application/json");
    expect(schemaRef(response200)).toBe("#/components/schemas/HealthStatus");
  });

  it("HEALTH-READY-002 publishes the 503 Problem Details response for readiness", async () => {
    const published = await fetchPublishedOpenApi();
    const paths = isObject(published.paths) ? published.paths : {};
    const readyPath = isObject(paths["/health/ready"]) ? paths["/health/ready"] : undefined;
    const ready = isObject(readyPath?.get) ? (readyPath?.get as JsonObject) : undefined;
    const response503 = isObject(ready?.responses)
      ? (ready?.responses as JsonObject)["503"]
      : undefined;

    expect(response503).toBeDefined();
    expect(mediaTypes(response503)).toContain("application/problem+json");
    expect(schemaRef(response503)).toBe("#/components/schemas/ProblemDetails");
  });

  it("HEALTH-READY-003 keeps internal details out of the documented 503 schema", async () => {
    const published = await fetchPublishedOpenApi();
    const components = isObject(published.components) ? published.components : {};
    const schemas = isObject(components.schemas) ? (components.schemas as JsonObject) : {};
    const problem = isObject(schemas.ProblemDetails)
      ? (schemas.ProblemDetails as JsonObject)
      : undefined;
    expect(problem).toBeDefined();
    const properties = isObject(problem?.properties) ? (problem?.properties as JsonObject) : {};
    expect(Object.keys(properties).sort()).toEqual(
      ["type", "title", "status", "detail", "instance", "code", "traceId"].sort()
    );
    const serialized = JSON.stringify(problem);
    expect(serialized).not.toMatch(/mongodb:\/\//i);
    expect(serialized).not.toMatch(/super-secret-password/i);
    expect(serialized).not.toMatch(/node_modules/i);
  });

  it("converges with the expected design slice for routes, methods and media types", async () => {
    const expected = loadHealthSliceFromContract();
    const published = await fetchPublishedOpenApi();
    const paths = isObject(published.paths) ? published.paths : {};

    const livePath = isObject(paths["/health/live"]) ? paths["/health/live"] : undefined;
    const live = isObject(livePath?.get) ? (livePath?.get as JsonObject) : undefined;
    expect(live?.operationId).toBe(expected.live.operationId);
    expect(
      mediaTypes(isObject(live?.responses) ? (live?.responses as JsonObject)["200"] : undefined)
    ).toEqual(
      mediaTypes(
        isObject(expected.live.responses)
          ? (expected.live.responses as JsonObject)["200"]
          : undefined
      )
    );

    const readyPath = isObject(paths["/health/ready"]) ? paths["/health/ready"] : undefined;
    const ready = isObject(readyPath?.get) ? (readyPath?.get as JsonObject) : undefined;
    expect(ready?.operationId).toBe(expected.ready.operationId);
    for (const status of Object.keys(
      isObject(expected.ready.responses) ? (expected.ready.responses as JsonObject) : {}
    )) {
      const expectedResponse = isObject(expected.ready.responses)
        ? (expected.ready.responses as JsonObject)[status]
        : undefined;
      const publishedResponse = isObject(ready?.responses)
        ? (ready?.responses as JsonObject)[status]
        : undefined;
      expect(publishedResponse).toBeDefined();
      const expectedMedia = mediaTypes(expectedResponse);
      const publishedMedia = mediaTypes(publishedResponse);
      for (const media of expectedMedia) {
        expect(publishedMedia).toContain(media);
      }
      const expectedRef = schemaRef(expectedResponse);
      const publishedRef = schemaRef(publishedResponse);
      if (expectedRef) {
        expect(publishedRef).toBe(expectedRef);
      }
    }
  });

  it("keeps the HealthStatus and ProblemDetails schemas aligned with the design", async () => {
    const expected = loadHealthSliceFromContract();
    const published = await fetchPublishedOpenApi();
    const components = isObject(published.components) ? published.components : {};
    const schemas = isObject(components.schemas) ? (components.schemas as JsonObject) : {};

    for (const schemaName of ["HealthStatus", "ProblemDetails"]) {
      const expectedSchema = isObject(expected.schemas[schemaName])
        ? (expected.schemas[schemaName] as JsonObject)
        : undefined;
      const publishedSchema = isObject(schemas[schemaName])
        ? (schemas[schemaName] as JsonObject)
        : undefined;
      expect(publishedSchema).toBeDefined();
      expect(publishedSchema?.type).toBe(expectedSchema?.type);
      expect(publishedSchema?.additionalProperties).toBe(expectedSchema?.additionalProperties);
      expect(normalizeRequired(publishedSchema?.required)).toEqual(
        normalizeRequired(expectedSchema?.required)
      );

      const expectedProps = isObject(expectedSchema?.properties)
        ? (expectedSchema?.properties as JsonObject)
        : {};
      const publishedProps = isObject(publishedSchema?.properties)
        ? (publishedSchema?.properties as JsonObject)
        : {};
      for (const propertyName of Object.keys(expectedProps)) {
        expect(publishedProps[propertyName]).toBeDefined();
      }
      if (isObject(expectedProps.status) && isObject(publishedProps.status)) {
        expect(matchesConstOrEnum(expectedProps.status, publishedProps.status)).toBe(true);
      }
    }
  });

  it("does not advertise ETag, rate-limit or Retry-After policies on the health operations", async () => {
    const published = await fetchPublishedOpenApi();
    const paths = isObject(published.paths) ? published.paths : {};

    for (const pathKey of ["/health/live", "/health/ready"]) {
      const pathEntry = isObject(paths[pathKey]) ? paths[pathKey] : undefined;
      const operation = isObject(pathEntry?.get) ? (pathEntry?.get as JsonObject) : undefined;
      expect(operation).toBeDefined();

      const responses = isObject(operation?.responses) ? (operation?.responses as JsonObject) : {};
      for (const response of Object.values(responses)) {
        const headers =
          isObject(response) && isObject((response as JsonObject).headers)
            ? ((response as JsonObject).headers as JsonObject)
            : {};
        expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("etag");
        expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("retry-after");
      }
      expect(operation?.security).toBeUndefined();
      const serialized = JSON.stringify(operation);
      expect(serialized.toLowerCase()).not.toContain("x-rate-limit");
      expect(serialized.toLowerCase()).not.toContain("rate-limit");
    }
  });
});
