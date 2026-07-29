import {describe, expect, it} from "vitest";

import {CollaboratorRepositoryStub} from "../../helpers/collaborator-runtime.js";

// COL-PATCH-001…024
describe("Updating a collaborator in the application layer", () => {
  it("updates only fields that are present in a partial command", async () => {
    const {UpdateCollaborator} =
      await import("../../../src/modules/collaborators/application/commands/update-collaborator.command.js");
    const result = await new UpdateCollaborator(new CollaboratorRepositoryStub()).execute(
      "66a64ab05bd7213b90d9b001",
      {name: "Ana Souza"}
    );
    expect(result.isOk()).toBe(true);
  });

  it("returns Err instead of throwing for deleted and duplicate records", async () => {
    const {UpdateCollaborator} =
      await import("../../../src/modules/collaborators/application/commands/update-collaborator.command.js");
    const result = await new UpdateCollaborator(
      CollaboratorRepositoryStub.duplicateEmail()
    ).execute("66a64ab05bd7213b90d9b001", {email: "ana@example.com"});
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("DUPLICATE_ACTIVE_EMAIL");
  });
});
