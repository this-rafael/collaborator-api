import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {Server} from "../../src/Server.js";
import {loadDeleteCollaboratorSliceFromExpected} from "../helpers/openapi-slice.js";
import {publishedOperation} from "./collaborators-contract.helpers.js";

// COL-DELETE-001…008, TX-001…003
describe("Published delete collaborator contract", () => {
  beforeAll(PlatformTest.bootstrap(Server));
  afterAll(PlatformTest.reset);

  it("publishes the idempotent delete operation and its no-content response", async () => {
    const operation = await publishedOperation("/api/v1/collaborators/{id}", "delete");
    expect(operation.operationId).toBe(
      loadDeleteCollaboratorSliceFromExpected().operation.operationId
    );
    expect(operation.responses).toMatchObject({
      "204": expect.anything(),
      "400": expect.anything(),
      "404": expect.anything(),
      "429": expect.anything()
    });
  });
});
