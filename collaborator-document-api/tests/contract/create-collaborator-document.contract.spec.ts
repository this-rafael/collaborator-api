import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {Server} from "../../src/Server.js";
import {loadCreateCollaboratorDocumentSliceFromExpected} from "../helpers/openapi-slice.js";
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

describe("Published create collaborator document contract", () => {
  beforeAll(PlatformTest.bootstrap(Server, contractServerSettings));
  afterAll(PlatformTest.reset);

  it("publishes createCollaboratorDocument with HAL success and contracted failures", async () => {
    const expected = loadCreateCollaboratorDocumentSliceFromExpected();
    const operation = await publishedOperation("/api/v1/collaborator-documents", "post");

    expect(operation.operationId).toBe(expected.operation.operationId);
    expect(operation.operationId).toBe("createCollaboratorDocument");
    expect(requestContentTypes(operation)).toEqual(["application/json"]);
    expect(requestSchemaReference(operation)).toEqual({
      $ref: "#/components/schemas/CollaboratorDocumentCreateRequest"
    });
    expect(responseCodes(operation)).toEqual([
      "201",
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
    expect(responseContentTypes(operation, "201")).toEqual(["application/hal+json"]);
    expect(responseSchemaReference(operation, "201", "application/hal+json")).toEqual({
      $ref: "#/components/schemas/CollaboratorDocument"
    });
    expect(responseHeaderNames(operation, "201")).toEqual(["ETag", "Location"]);
    for (const status of ["400", "404", "409", "410", "415", "422", "429", "500", "503"]) {
      expect(responseContentTypes(operation, status)).toEqual(["application/problem+json"]);
      expect(responseSchemaReference(operation, status, "application/problem+json")).toEqual({
        $ref: "#/components/schemas/ProblemDetails"
      });
    }
    expect(responseHeaderNames(operation, "429")).toEqual(["Retry-After"]);
  });
});
