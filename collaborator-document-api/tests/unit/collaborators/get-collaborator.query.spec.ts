import {describe, expect, it} from "vitest";

import {CollaboratorRepositoryStub} from "../../helpers/collaborator-runtime.js";

describe("GetCollaboratorUseCase", () => {
  it("returns a primitive output for an existing collaborator", async () => {
    const {GetCollaboratorUseCase} =
      await import("../../../src/modules/collaborators/application/use-cases/get-collaborator.use-case.js");
    const result = await new GetCollaboratorUseCase(new CollaboratorRepositoryStub()).execute({
      id: "66a64ab05bd7213b90d9b001"
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.id).toBe("66a64ab05bd7213b90d9b001");
  });

  it("returns the stable not-found failure", async () => {
    const {GetCollaboratorUseCase} =
      await import("../../../src/modules/collaborators/application/use-cases/get-collaborator.use-case.js");
    const result = await new GetCollaboratorUseCase(CollaboratorRepositoryStub.notFound()).execute({
      id: "66a64ab05bd7213b90d9b099"
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("COLLABORATOR_NOT_FOUND");
  });

  it("exposes the canonical not-found failure as discriminated data", async () => {
    const {collaboratorNotFoundFailure} =
      await import("../../../src/modules/collaborators/domain/errors/collaborator-not-found.failure.js");

    expect(collaboratorNotFoundFailure()).toEqual({
      kind: "application",
      code: "COLLABORATOR_NOT_FOUND",
      message: "Collaborator was not found."
    });
  });
});
