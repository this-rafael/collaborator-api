import {describe, expect, it} from "vitest";

import {CollaboratorRepositoryStub} from "../helpers/collaborator-runtime.js";

describe("ListCollaboratorsUseCase", () => {
  it("returns primitive active outputs", async () => {
    const {ListCollaboratorsUseCase} =
      await import("../../src/modules/collaborators/application/use-cases/list-collaborators.use-case.js");

    const result = await new ListCollaboratorsUseCase(new CollaboratorRepositoryStub()).execute({
      filters: {},
      limit: 20
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk())
      expect(result.value.items.every((item) => item.deletedAt === null)).toBe(true);
  });

  it("preserves repository availability failures", async () => {
    const {ListCollaboratorsUseCase} =
      await import("../../src/modules/collaborators/application/use-cases/list-collaborators.use-case.js");

    const result = await new ListCollaboratorsUseCase(
      CollaboratorRepositoryStub.unavailable()
    ).execute({
      filters: {},
      limit: 20
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("rejects invalid pagination and filters before querying persistence", async () => {
    const {ListCollaboratorsUseCase} =
      await import("../../src/modules/collaborators/application/use-cases/list-collaborators.use-case.js");
    let calls = 0;
    const repository = {
      listActive: () => {
        calls += 1;
        return CollaboratorRepositoryStub.unavailable().listActive();
      }
    };
    const useCase = new ListCollaboratorsUseCase(repository);

    const invalidLimit = await useCase.execute({filters: {}, limit: 101});
    const invalidFilters = await useCase.execute({filters: {cpf: "123"}, limit: 20});

    expect(invalidLimit.isErr()).toBe(true);
    expect(invalidFilters.isErr()).toBe(true);
    if (invalidLimit.isErr()) expect(invalidLimit.error.code).toBe("INVALID_QUERY_PARAMETER");
    if (invalidFilters.isErr()) expect(invalidFilters.error.code).toBe("INVALID_QUERY_PARAMETER");
    expect(calls).toBe(0);
  });
});
