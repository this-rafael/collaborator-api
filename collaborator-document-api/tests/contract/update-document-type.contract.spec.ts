import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {Server} from "../../src/Server.js";
import {loadUpdateDocumentTypeSliceFromExpected} from "../helpers/openapi-slice.js";
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

describe("Published update document type contract", () => {
  beforeAll(PlatformTest.bootstrap(Server, contractServerSettings));
  afterAll(PlatformTest.reset);

  it("publishes partial update semantics and state conflict responses", async () => {
    const operation = await publishedOperation("/api/v1/document-types/{id}", "patch");
    expect(operation.operationId).toBe(
      loadUpdateDocumentTypeSliceFromExpected().operation.operationId
    );
    expect(requestContentTypes(operation)).toEqual(["application/json"]);
    expect(requestSchemaReference(operation)).toEqual({
      $ref: "#/components/schemas/DocumentTypePatchRequest"
    });
    expect(responseCodes(operation)).toEqual([
      "200",
      "400",
      "404",
      "409",
      "410",
      "415",
      "422",
      "429",
      "500",
      "503"
    ]);
    expect(responseContentTypes(operation, "200")).toEqual(["application/hal+json"]);
    expect(responseSchemaReference(operation, "200", "application/hal+json")).toEqual({
      $ref: "#/components/schemas/DocumentType"
    });
    expect(responseHeaderNames(operation, "200")).toEqual(["ETag"]);
    for (const status of ["400", "404", "409", "410", "415", "422", "429", "500", "503"]) {
      expect(responseContentTypes(operation, status)).toEqual(["application/problem+json"]);
      expect(responseSchemaReference(operation, status, "application/problem+json")).toEqual({
        $ref: "#/components/schemas/ProblemDetails"
      });
    }
    expect(responseHeaderNames(operation, "429")).toEqual(["Retry-After"]);
  });
});
