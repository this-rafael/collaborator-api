import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {Server} from "../../src/Server.js";
import {loadListCollaboratorsSliceFromExpected} from "../helpers/openapi-slice.js";
import {
  contractServerSettings,
  parameterNames,
  publishedOperation,
  responseCodes,
  responseContentTypes,
  responseHeaderNames,
  responseSchemaReference
} from "./collaborators-contract.helpers.js";

describe("Published list collaborators contract", () => {
  beforeAll(PlatformTest.bootstrap(Server, contractServerSettings));
  afterAll(PlatformTest.reset);

  it("publishes the collection operation with cursor filters cache and problem responses", async () => {
    const operation = await publishedOperation("/api/v1/collaborators", "get");
    expect(operation.operationId).toBe(
      loadListCollaboratorsSliceFromExpected().operation.operationId
    );
    expect(parameterNames(operation)).toEqual([
      "If-None-Match",
      "cpf",
      "cursor",
      "email",
      "limit",
      "name"
    ]);
    expect(responseCodes(operation)).toEqual(["200", "304", "400", "429", "500", "503"]);
    expect(responseContentTypes(operation, "200")).toEqual(["application/hal+json"]);
    expect(responseSchemaReference(operation, "200", "application/hal+json")).toEqual({
      $ref: "#/components/schemas/CollaboratorCollection"
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
