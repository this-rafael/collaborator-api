import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {Server} from "../../src/Server.js";
import {loadDeleteCollaboratorSliceFromExpected} from "../helpers/openapi-slice.js";
import {
  contractServerSettings,
  publishedOperation,
  responseCodes,
  responseContentTypes,
  responseHeaderNames,
  responseSchemaReference
} from "./collaborators-contract.helpers.js";

describe("Published delete collaborator contract", () => {
  beforeAll(PlatformTest.bootstrap(Server, contractServerSettings));
  afterAll(PlatformTest.reset);

  it("publishes the idempotent delete operation and its no-content response", async () => {
    const operation = await publishedOperation("/api/v1/collaborators/{id}", "delete");
    expect(operation.operationId).toBe(
      loadDeleteCollaboratorSliceFromExpected().operation.operationId
    );
    expect(responseCodes(operation)).toEqual(["204", "400", "404", "429", "500", "503"]);
    expect(responseContentTypes(operation, "204")).toEqual([]);
    for (const status of ["400", "404", "429", "500", "503"]) {
      expect(responseContentTypes(operation, status)).toEqual(["application/problem+json"]);
      expect(responseSchemaReference(operation, status, "application/problem+json")).toEqual({
        $ref: "#/components/schemas/ProblemDetails"
      });
    }
    expect(responseHeaderNames(operation, "429")).toEqual(["Retry-After"]);
  });
});
