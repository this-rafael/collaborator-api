import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {Server} from "../../src/Server.js";
import {loadGetCollaboratorSliceFromExpected} from "../helpers/openapi-slice.js";
import {publishedOperation} from "./collaborators-contract.helpers.js";

// COL-GET-001…008
describe("Published get collaborator contract", () => {
  beforeAll(PlatformTest.bootstrap(Server));
  afterAll(PlatformTest.reset);

  it("publishes the identifier parameter representation and error responses", async () => {
    const operation = await publishedOperation("/api/v1/collaborators/{id}", "get");
    expect(operation.operationId).toBe(
      loadGetCollaboratorSliceFromExpected().operation.operationId
    );
    expect(operation.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({name: "id", in: "path"})])
    );
    expect(operation.responses).toMatchObject({
      "200": expect.anything(),
      "304": expect.anything(),
      "400": expect.anything(),
      "404": expect.anything()
    });
  });
});
