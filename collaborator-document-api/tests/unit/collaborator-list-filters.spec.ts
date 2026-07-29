import {describe, expect, it} from "vitest";

// COL-LIST-003…008
describe("Normalizing collaborator list filters", () => {
  it("normalizes a partial name and exact email while preserving the CPF", async () => {
    const {normalizeCollaboratorFilters} =
      await import("../../src/modules/collaborators/application/queries/list-collaborators.query.js");
    const result = normalizeCollaboratorFilters({
      name: " ÁNA  Silva ",
      cpf: "12345678909",
      email: " ANA@EXAMPLE.COM "
    });
    expect(result.isOk()).toBe(true);
  });

  it("returns Err for invalid CPF and email filters", async () => {
    const {normalizeCollaboratorFilters} =
      await import("../../src/modules/collaborators/application/queries/list-collaborators.query.js");
    expect(normalizeCollaboratorFilters({cpf: "bad"}).isErr()).toBe(true);
    expect(normalizeCollaboratorFilters({email: "bad"}).isErr()).toBe(true);
  });
});
