import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";
import supertest from "supertest";

import {Server} from "../../src/Server.js";
import {
  expectedFunctionalOperationIds,
  loadCreateCollaboratorSliceFromExpected,
  loadDiscoverySliceFromExpected,
  type JsonObject,
  type JsonValue
} from "../helpers/openapi-slice.js";
import {problemDetailsFixture} from "../helpers/discovery-fixtures.js";
import {contractServerSettings} from "./collaborators-contract.helpers.js";

const isObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeRequired = (value: JsonValue | undefined): JsonValue =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.replace(/^-\s*/, "") : (item ?? null)))
    : (value ?? null);

const etagPattern = /^W\/"sha256:[a-f0-9]{64}"$/;

const fetchPublishedOpenApi = async (): Promise<JsonValue> => {
  const candidates = ["/openapi.json", "/openapi.yaml", "/api/openapi.json", "/docs/openapi.json"];
  for (const path of candidates) {
    const response = await supertest(PlatformTest.callback())
      .get(path)
      .set("Accept", "application/json");
    if (response.status === 200 && response.body && typeof response.body === "object") {
      return response.body as JsonValue;
    }
  }
  throw new Error("OpenAPI document endpoint not exposed by the implementation");
};

describe("Published OpenAPI matches the discoverApi slice", () => {
  beforeAll(PlatformTest.bootstrap(Server, contractServerSettings));
  afterAll(PlatformTest.reset);

  it("publishes discoverApi on /api/v1 among the known public functional operations", async () => {
    const published = await fetchPublishedOpenApi();
    if (!isObject(published)) {
      throw new Error("Published OpenAPI document must be a mapping");
    }
    expect(published.openapi).toMatch(/^3\./);

    const paths = isObject(published.paths) ? published.paths : {};
    expect(Object.keys(paths)).toContain("/api/v1");
    const pathEntry = isObject(paths["/api/v1"]) ? paths["/api/v1"] : undefined;
    const operation = isObject(pathEntry?.get) ? (pathEntry?.get as JsonObject) : undefined;
    expect(operation).toBeDefined();
    expect(operation?.operationId).toBe("discoverApi");

    const functionalOperationIds: string[] = [];
    for (const [pathKey, pathValue] of Object.entries(paths)) {
      if (pathKey.startsWith("/health")) {
        continue;
      }
      if (!isObject(pathValue)) {
        continue;
      }
      for (const method of ["get", "post", "put", "patch", "delete"]) {
        const op = pathValue[method];
        if (isObject(op) && typeof op.operationId === "string") {
          functionalOperationIds.push(op.operationId);
        }
      }
    }
    expect(functionalOperationIds).toEqual([...expectedFunctionalOperationIds]);
  });

  it("matches the design slice for path, method, headers, schemas and responses", async () => {
    const expected = loadDiscoverySliceFromExpected();
    const published = await fetchPublishedOpenApi();
    if (!isObject(published)) {
      throw new Error("Published OpenAPI document must be a mapping");
    }

    const publishedPaths = isObject(published.paths) ? published.paths : {};
    const publishedPath = isObject(publishedPaths["/api/v1"])
      ? publishedPaths["/api/v1"]
      : undefined;
    const publishedOperation = isObject(publishedPath?.get)
      ? (publishedPath?.get as JsonObject)
      : undefined;
    expect(publishedOperation).toBeDefined();

    expect(publishedOperation?.operationId).toBe(expected.operation.operationId);
    expect(publishedOperation?.summary).toBe(expected.operation.summary);

    const expectedParameters = Array.isArray(expected.operation.parameters)
      ? expected.operation.parameters
      : [];
    const publishedParametersRaw = Array.isArray(publishedOperation?.parameters)
      ? publishedOperation?.parameters
      : [];
    expect(publishedParametersRaw).toHaveLength(expectedParameters.length);
    for (const expectedParameter of expectedParameters) {
      if (!isObject(expectedParameter)) {
        continue;
      }
      const match = publishedParametersRaw.find(
        (candidate) => isObject(candidate) && candidate.$ref === expectedParameter.$ref
      );
      expect(match).toBeDefined();
    }

    const expectedResponses = isObject(expected.operation.responses)
      ? expected.operation.responses
      : {};
    const publishedResponses = isObject(publishedOperation?.responses)
      ? publishedOperation?.responses
      : {};
    for (const status of Object.keys(expectedResponses)) {
      const expectedResponse = expectedResponses[status];
      const publishedResponse = publishedResponses[status];
      expect(publishedResponse).toBeDefined();
      const expectedResponseResolved =
        isObject(expectedResponse) && typeof expectedResponse.$ref === "string"
          ? expected.responses[expectedResponse.$ref.replace("#/components/responses/", "")]
          : expectedResponse;
      if (isObject(expectedResponseResolved) && isObject(expectedResponseResolved.content)) {
        const content = expectedResponseResolved.content as Record<string, JsonValue>;
        const mediaKeys = Object.keys(content);
        const publishedContent =
          isObject(publishedResponse) && isObject(publishedResponse.content)
            ? (publishedResponse.content as JsonObject)
            : undefined;
        expect(publishedContent).toBeDefined();
        for (const media of mediaKeys) {
          expect(publishedContent?.[media]).toBeDefined();
        }
        if (isObject(expectedResponseResolved.headers)) {
          const publishedHeaders =
            isObject(publishedResponse) && isObject(publishedResponse.headers)
              ? (publishedResponse.headers as JsonObject)
              : undefined;
          for (const headerName of Object.keys(expectedResponseResolved.headers as JsonObject)) {
            expect(publishedHeaders?.[headerName]).toBeDefined();
          }
        }
      }
    }

    const expectedComponents = isObject(expected.schemas) ? expected.schemas : {};
    const publishedComponents = isObject(published.components) ? published.components : {};
    const publishedSchemas = isObject(publishedComponents.schemas)
      ? publishedComponents.schemas
      : {};
    for (const schemaName of ["ApiRoot", "HalLink", "ProblemDetails"]) {
      expect(publishedSchemas[schemaName]).toBeDefined();
      const expectedSchema = expectedComponents[schemaName];
      const publishedSchema = publishedSchemas[schemaName];
      expect(isObject(expectedSchema) && isObject(publishedSchema)).toBe(true);
      if (!isObject(expectedSchema) || !isObject(publishedSchema)) {
        continue;
      }
      expect(publishedSchema.type).toBe(expectedSchema.type);
      expect(publishedSchema.additionalProperties).toBe(expectedSchema.additionalProperties);
      const expectedRequired = normalizeRequired(expectedSchema.required);
      const publishedRequired = normalizeRequired(publishedSchema.required);
      expect(publishedRequired).toEqual(expectedRequired);
      const expectedSchemaProperties = isObject(expectedSchema.properties)
        ? expectedSchema.properties
        : {};
      const publishedSchemaProperties = isObject(publishedSchema.properties)
        ? publishedSchema.properties
        : {};
      for (const propertyName of Object.keys(expectedSchemaProperties)) {
        expect(publishedSchemaProperties[propertyName]).toBeDefined();
      }
    }
  });

  it("declares the ETag header pattern matching the design", async () => {
    const published = await fetchPublishedOpenApi();
    if (
      !isObject(published) ||
      !isObject(published.components) ||
      !isObject(published.components.headers)
    ) {
      throw new Error("Published OpenAPI must declare shared headers");
    }
    const etagHeader = published.components.headers.ETag as JsonObject | undefined;
    expect(etagHeader).toBeDefined();
    const schema = isObject(etagHeader?.schema) ? (etagHeader?.schema as JsonObject) : undefined;
    expect(
      String(schema?.pattern)
        .replace(/^\^|\$$/g, "")
        .replaceAll("\\/", "/")
    ).toBe(etagPattern.source.replace(/^\^|\$$/g, "").replaceAll("\\/", "/"));
  });

  it("keeps the Problem Details schema identical to the design", async () => {
    const expected = loadDiscoverySliceFromExpected();
    const published = await fetchPublishedOpenApi();
    if (
      !isObject(published) ||
      !isObject(published.components) ||
      !isObject(published.components.schemas)
    ) {
      throw new Error("Published OpenAPI must declare shared schemas");
    }
    const publishedProblemDetails = published.components.schemas.ProblemDetails as JsonObject;
    const expectedProblemDetails = expected.schemas.ProblemDetails as JsonObject;
    expect(publishedProblemDetails).toBeDefined();
    expect(normalizeRequired(publishedProblemDetails.required)).toEqual(
      normalizeRequired(expectedProblemDetails.required)
    );
    const publishedProperties = isObject(publishedProblemDetails.properties)
      ? publishedProblemDetails.properties
      : {};
    const expectedProperties = isObject(expectedProblemDetails.properties)
      ? expectedProblemDetails.properties
      : {};
    for (const propertyName of Object.keys(expectedProperties)) {
      expect(publishedProperties[propertyName]).toBeDefined();
    }
  });

  it("binds discovery and collaborator public rules and rejects extra public rules", async () => {
    const expected = loadDiscoverySliceFromExpected();
    const published = await fetchPublishedOpenApi();
    if (!isObject(published) || !isObject(published.paths)) {
      throw new Error("Published OpenAPI must declare paths");
    }
    const publishedFunctionalIds: string[] = [];
    for (const [pathKey, pathValue] of Object.entries(published.paths)) {
      if (pathKey.startsWith("/health")) {
        continue;
      }
      if (!isObject(pathValue)) {
        continue;
      }
      for (const method of ["get", "post", "put", "patch", "delete"]) {
        const op = pathValue[method];
        if (isObject(op) && typeof op.operationId === "string") {
          publishedFunctionalIds.push(op.operationId);
        }
      }
    }
    expect(publishedFunctionalIds).toEqual([...expected.functionalOperationIds]);

    const problemDetails =
      isObject(published.components) && isObject(published.components.schemas)
        ? (published.components.schemas.ProblemDetails as JsonObject | undefined)
        : undefined;
    const codes =
      isObject(problemDetails?.properties) && isObject(problemDetails?.properties.code)
        ? (problemDetails?.properties.code as JsonObject)
        : undefined;
    const expectedProblemDetails = loadCreateCollaboratorSliceFromExpected().schemas
      .ProblemDetails as JsonObject;
    const expectedCodes = isObject(expectedProblemDetails?.properties)
      ? (expectedProblemDetails.properties.code as JsonObject | undefined)
      : undefined;
    const expectedEnum = Array.isArray(expectedCodes?.enum)
      ? expectedCodes.enum.map((code) =>
          typeof code === "string" ? code.replace(/^-\s*/, "") : code
        )
      : expectedCodes?.enum;
    expect(codes?.enum).toEqual(expectedEnum);
    expect(problemDetailsFixture().status).toBeGreaterThanOrEqual(400);
  });
});
