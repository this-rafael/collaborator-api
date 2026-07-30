import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {Server} from "../../src/Server.js";
import {loadGetCollaboratorSliceFromExpected} from "../helpers/openapi-slice.js";
import {
  contractServerSettings,
  parameterNames,
  publishedOperation,
  responseCodes,
  responseContentTypes,
  responseHeaderNames,
  responseSchemaReference
} from "./collaborators-contract.helpers.js";

describe("Published get collaborator contract", () => {
  beforeAll(PlatformTest.bootstrap(Server, contractServerSettings));
  afterAll(PlatformTest.reset);

  it("publishes the identifier parameter representation and error responses", async () => {
    const operation = await publishedOperation("/api/v1/collaborators/{id}", "get");
    expect(operation.operationId).toBe(
      loadGetCollaboratorSliceFromExpected().operation.operationId
    );
    expect(parameterNames(operation)).toEqual(["If-None-Match", "id"]);
    expect(responseCodes(operation)).toEqual(["200", "304", "400", "404", "429", "500", "503"]);
    expect(responseContentTypes(operation, "200")).toEqual(["application/hal+json"]);
    expect(responseSchemaReference(operation, "200", "application/hal+json")).toEqual({
      $ref: "#/components/schemas/Collaborator"
    });
    expect(responseHeaderNames(operation, "200")).toEqual(["ETag"]);
    for (const status of ["400", "404", "429", "500", "503"]) {
      expect(responseContentTypes(operation, status)).toEqual(["application/problem+json"]);
      expect(responseSchemaReference(operation, status, "application/problem+json")).toEqual({
        $ref: "#/components/schemas/ProblemDetails"
      });
    }
    expect(responseHeaderNames(operation, "429")).toEqual(["Retry-After"]);
  });
});
