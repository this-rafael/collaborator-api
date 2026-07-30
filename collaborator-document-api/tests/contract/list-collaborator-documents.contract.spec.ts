import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {Server} from "../../src/Server.js";
import {loadListCollaboratorDocumentsSliceFromExpected} from "../helpers/openapi-slice.js";
import {
  contractServerSettings,
  parameterNames,
  publishedOperation,
  responseCodes,
  responseContentTypes,
  responseHeaderNames,
  responseSchemaReference
} from "./collaborators-contract.helpers.js";

describe("Published list collaborator documents contract", () => {
  beforeAll(PlatformTest.bootstrap(Server, contractServerSettings));
  afterAll(PlatformTest.reset);

  it("publishes only the GET collection slice with filters, pagination, cache, and failures", async () => {
    const operation = await publishedOperation("/api/v1/collaborator-documents", "get");
    expect(operation.operationId).toBe(
      loadListCollaboratorDocumentsSliceFromExpected().operation.operationId
    );
    expect(parameterNames(operation)).toEqual([
      "If-None-Match",
      "collaboratorId",
      "cursor",
      "documentTypeId",
      "lifecycle",
      "limit",
      "status"
    ]);
    expect(responseCodes(operation)).toEqual(["200", "304", "400", "429", "500", "503"]);
    expect(responseContentTypes(operation, "200")).toEqual(["application/hal+json"]);
    expect(responseSchemaReference(operation, "200", "application/hal+json")).toEqual({
      $ref: "#/components/schemas/CollaboratorDocumentCollection"
    });
    expect(responseHeaderNames(operation, "200")).toEqual(["ETag"]);
    for (const status of ["400", "429", "500", "503"]) {
      expect(responseContentTypes(operation, status)).toEqual(["application/problem+json"]);
      expect(responseSchemaReference(operation, status, "application/problem+json")).toEqual({
        $ref: "#/components/schemas/ProblemDetails"
      });
    }
    expect(responseHeaderNames(operation, "429")).toEqual(["Retry-After"]);
  });
});
