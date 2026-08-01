import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {Server} from "../../src/Server.js";
import {loadGetDocumentVersionSliceFromContract} from "../helpers/openapi-slice.js";
import {
  contractServerSettings,
  parameterNames,
  publishedOperation,
  responseCodes,
  responseContentTypes,
  responseHeaderNames,
  responseSchemaReference
} from "./collaborators-contract.helpers.js";

describe("Published get document version contract", () => {
  beforeAll(PlatformTest.bootstrap(Server, contractServerSettings));
  afterAll(PlatformTest.reset);

  it("publishes the GET resource with cache validation and every contracted failure", async () => {
    const expected = loadGetDocumentVersionSliceFromContract();
    const operation = await publishedOperation(
      "/api/v1/collaborator-documents/{id}/versions/{version}",
      "get"
    );

    expect(operation.operationId).toBe(expected.operation.operationId);
    expect(operation.operationId).toBe("getDocumentVersion");
    expect(parameterNames(operation).filter((name) => name !== "id" && name !== "version")).toEqual(
      ["If-None-Match"]
    );
    expect(responseCodes(operation)).toEqual(responseCodes(expected.operation));
    expect(responseContentTypes(operation, "200")).toEqual(["application/hal+json"]);
    expect(responseSchemaReference(operation, "200", "application/hal+json")).toEqual({
      $ref: "#/components/schemas/DocumentVersion"
    });
    expect(responseHeaderNames(operation, "200")).toEqual(["ETag"]);
    expect(responseContentTypes(operation, "304")).toEqual([]);
    for (const status of ["400", "404", "429", "500", "503"]) {
      expect(responseContentTypes(operation, status)).toEqual(["application/problem+json"]);
      expect(responseSchemaReference(operation, status, "application/problem+json")).toEqual({
        $ref: "#/components/schemas/ProblemDetails"
      });
    }
    expect(responseHeaderNames(operation, "429")).toEqual(["Retry-After"]);
  });
});
