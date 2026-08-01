import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {Server} from "../../src/Server.js";
import {loadCreateDocumentVersionSliceFromContract} from "../helpers/openapi-slice.js";
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

describe("Published create document version contract", () => {
  beforeAll(PlatformTest.bootstrap(Server, contractServerSettings));
  afterAll(PlatformTest.reset);

  it("publishes the request, HAL success, and every contracted failure", async () => {
    const expected = loadCreateDocumentVersionSliceFromContract();
    const operation = await publishedOperation(
      "/api/v1/collaborator-documents/{id}/versions",
      "post"
    );

    expect(operation.operationId).toBe(expected.operation.operationId);
    expect(operation.operationId).toBe("createDocumentVersion");
    expect(requestContentTypes(operation)).toEqual(requestContentTypes(expected.operation));
    expect(requestSchemaReference(operation)).toEqual(requestSchemaReference(expected.operation));
    expect(responseCodes(operation)).toEqual(responseCodes(expected.operation));
    expect(responseContentTypes(operation, "201")).toEqual(["application/hal+json"]);
    expect(responseSchemaReference(operation, "201", "application/hal+json")).toEqual({
      $ref: "#/components/schemas/DocumentVersion"
    });
    expect(responseHeaderNames(operation, "201")).toEqual(["Location"]);
    for (const status of ["400", "404", "410", "415", "422", "429", "500", "503"]) {
      expect(responseContentTypes(operation, status)).toEqual(["application/problem+json"]);
      expect(responseSchemaReference(operation, status, "application/problem+json")).toEqual({
        $ref: "#/components/schemas/ProblemDetails"
      });
    }
    expect(responseHeaderNames(operation, "429")).toEqual(["Retry-After"]);
  });
});
