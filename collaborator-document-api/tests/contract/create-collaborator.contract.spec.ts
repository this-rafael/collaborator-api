import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PlatformTest} from "@tsed/platform-http/testing";

import {Server} from "../../src/Server.js";
import {loadCreateCollaboratorSliceFromExpected} from "../helpers/openapi-slice.js";
import {publishedOperation} from "./collaborators-contract.helpers.js";

// COL-CREATE-001…025
describe("Published create collaborator contract", () => {
  beforeAll(PlatformTest.bootstrap(Server));
  afterAll(PlatformTest.reset);

  it("publishes the create operation with request schema and contracted responses", async () => {
    const operation = await publishedOperation("/api/v1/collaborators", "post");
    expect(operation.operationId).toBe(
      loadCreateCollaboratorSliceFromExpected().operation.operationId
    );
    expect(operation.requestBody).toBeDefined();
    expect(operation.responses).toMatchObject({
      "201": expect.anything(),
      "409": expect.anything(),
      "422": expect.anything()
    });
  });
});
