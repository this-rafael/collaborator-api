import {describe, expect, it} from "vitest";

import type {
  CollaboratorIdInput,
  CollaboratorListFiltersInput,
  CreateCollaboratorInput,
  ListCollaboratorsInput,
  UpdateCollaboratorInput
} from "../../src/modules/collaborators/application/contracts/collaborator-input.js";

describe("Collaborator input contracts", () => {
  it("remain type-only runtime-free boundaries between presentation and application", async () => {
    const create: CreateCollaboratorInput = {
      name: "Ana Silva",
      cpf: "12345678909",
      email: "ana@example.com"
    };
    const update: UpdateCollaboratorInput = {
      id: "66a64ab05bd7213b90d9b001",
      patch: {name: "Ana Souza"}
    };
    const filters: CollaboratorListFiltersInput = {name: "ana", cpf: "12345678909"};
    const list: ListCollaboratorsInput = {filters, limit: 20, afterId: update.id};
    const identifier: CollaboratorIdInput = {id: list.afterId!};

    expect({create, update, filters, list, identifier}).toMatchObject({
      create: {name: "Ana Silva"},
      update: {patch: {name: "Ana Souza"}},
      list: {limit: 20},
      identifier: {id: update.id}
    });

    const runtimeModule =
      await import("../../src/modules/collaborators/application/contracts/collaborator-input.js");
    expect(Object.keys(runtimeModule)).toEqual([]);
  });
});
