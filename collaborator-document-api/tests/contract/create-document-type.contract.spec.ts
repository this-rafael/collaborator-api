import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {Server} from "../../src/Server.js";
import {loadCreateDocumentTypeSliceFromExpected} from "../helpers/openapi-slice.js";
import {
  contractServerSettings,
  publishedOperation,
  requestContentTypes,
  requestSchemaReference,
  responseCodes,
  responseContentTypes,
  responseHeaderNames,
  responseSchemaReference
} from "./collaborators-contract.helpers.js";

describe("Published create document type contract", () => {
  beforeAll(PlatformTest.bootstrap(Server, contractServerSettings));
  afterAll(PlatformTest.reset);

  it("publishes the create request, HAL representation, and all contracted failures", async () => {
    const operation = await publishedOperation("/api/v1/document-types", "post");
    expect(operation.operationId).toBe(
      loadCreateDocumentTypeSliceFromExpected().operation.operationId
    );
    expect(requestContentTypes(operation)).toEqual(["application/json"]);
    expect(requestSchemaReference(operation)).toEqual({
      $ref: "#/components/schemas/DocumentTypeCreateRequest"
    });
    expect(responseCodes(operation)).toEqual([
      "201",
      "400",
      "409",
      "415",
      "422",
      "429",
      "500",
      "503"
    ]);
    expect(responseContentTypes(operation, "201")).toEqual(["application/hal+json"]);
    expect(responseSchemaReference(operation, "201", "application/hal+json")).toEqual({
      $ref: "#/components/schemas/DocumentType"
    });
    expect(responseHeaderNames(operation, "201")).toEqual(["ETag", "Location"]);
    for (const status of ["400", "409", "415", "422", "429", "500", "503"]) {
      expect(responseContentTypes(operation, status)).toEqual(["application/problem+json"]);
      expect(responseSchemaReference(operation, status, "application/problem+json")).toEqual({
        $ref: "#/components/schemas/ProblemDetails"
      });
    }
    expect(responseHeaderNames(operation, "429")).toEqual(["Retry-After"]);
  });
});
