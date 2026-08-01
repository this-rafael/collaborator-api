import {PlatformTest} from "@tsed/platform-http/testing";
import {afterAll, beforeAll, describe, expect, it} from "vitest";

import {Server} from "../../src/Server.js";
import {
  loadListSubmissionEventsSliceFromContract,
  loadListSubmissionEventsSliceFromExpected
} from "../helpers/openapi-slice.js";
import {
  contractServerSettings,
  parameterNames,
  publishedOperation,
  responseCodes,
  responseContentTypes,
  responseHeaderNames,
  responseSchemaReference
} from "./collaborators-contract.helpers.js";

describe("Published submission events contract", () => {
  beforeAll(PlatformTest.bootstrap(Server, contractServerSettings));
  afterAll(PlatformTest.reset);

  it("keeps the feature contract synchronized with the normative expected operation", () => {
    const feature = loadListSubmissionEventsSliceFromContract();
    const expected = loadListSubmissionEventsSliceFromExpected();

    expect(feature.operation).toEqual(expected.operation);
  });

  it("publishes the historical GET collection with pagination, cache, and failures", async () => {
    const expected = loadListSubmissionEventsSliceFromContract();
    const operation = await publishedOperation("/api/v1/submission-events", "get");

    expect(operation.operationId).toBe(expected.operation.operationId);
    expect(operation.operationId).toBe("listSubmissionEvents");
    expect(parameterNames(operation)).toEqual(["If-None-Match", "cursor", "limit"]);
    expect(responseCodes(operation)).toEqual(responseCodes(expected.operation));
    expect(responseContentTypes(operation, "200")).toEqual(["application/hal+json"]);
    expect(responseSchemaReference(operation, "200", "application/hal+json")).toEqual({
      $ref: "#/components/schemas/SubmissionEventCollection"
    });
    expect(responseHeaderNames(operation, "200")).toEqual(["ETag"]);
    expect(responseContentTypes(operation, "304")).toEqual([]);
    for (const status of ["400", "429", "500", "503"]) {
      expect(responseContentTypes(operation, status)).toEqual(["application/problem+json"]);
      expect(responseSchemaReference(operation, status, "application/problem+json")).toEqual({
        $ref: "#/components/schemas/ProblemDetails"
      });
    }
    expect(responseHeaderNames(operation, "429")).toEqual(["Retry-After"]);
  });
});
