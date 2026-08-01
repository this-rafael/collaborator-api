import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {Server} from "../../src/Server.js";
import {
  loadListPendingDocumentTypeStatisticsSliceFromContract,
  loadListPendingDocumentTypeStatisticsSliceFromExpected
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

describe("Published pending document type statistics contract", () => {
  beforeAll(PlatformTest.bootstrap(Server, contractServerSettings));
  afterAll(PlatformTest.reset);

  it("keeps the feature contract synchronized with the normative expected operation", () => {
    const feature = loadListPendingDocumentTypeStatisticsSliceFromContract();
    const expected = loadListPendingDocumentTypeStatisticsSliceFromExpected();

    expect(feature.operation).toEqual(expected.operation);
  });

  it("publishes the GET ranking with pagination, cache, and operational failures", async () => {
    const expected = loadListPendingDocumentTypeStatisticsSliceFromContract();
    const operation = await publishedOperation(path, "get");

    expect(operation.operationId).toBe(expected.operation.operationId);
    expect(operation.operationId).toBe("listPendingDocumentTypeStatistics");
    expect(parameterNames(operation)).toEqual(["If-None-Match", "cursor", "limit"]);
    expect(responseCodes(operation)).toEqual(responseCodes(expected.operation));
    expect(responseContentTypes(operation, "200")).toEqual(["application/hal+json"]);
    expect(responseSchemaReference(operation, "200", "application/hal+json")).toEqual({
      $ref: "#/components/schemas/PendingDocumentTypeStatisticsCollection"
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

const path = "/api/v1/statistics/pending-document-types";
