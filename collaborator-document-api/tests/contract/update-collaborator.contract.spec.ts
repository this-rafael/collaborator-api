import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {Server} from "../../src/Server.js";
import {loadUpdateCollaboratorSliceFromExpected} from "../helpers/openapi-slice.js";
import {publishedOperation} from "./collaborators-contract.helpers.js";

// COL-PATCH-001…024
describe("Published update collaborator contract", () => {
  beforeAll(PlatformTest.bootstrap(Server));
  afterAll(PlatformTest.reset);

  it("publishes the partial update schema and conflict responses", async () => {
    const operation = await publishedOperation("/api/v1/collaborators/{id}", "patch");
    expect(operation.operationId).toBe(
      loadUpdateCollaboratorSliceFromExpected().operation.operationId
    );
    expect(operation.requestBody).toBeDefined();
    expect(operation.responses).toMatchObject({
      "200": expect.anything(),
      "409": expect.anything(),
      "410": expect.anything(),
      "422": expect.anything()
    });
  });
});
