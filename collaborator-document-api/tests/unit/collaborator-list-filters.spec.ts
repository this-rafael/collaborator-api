import {describe, expect, it} from "vitest";

describe("normalizeCollaboratorFilters", () => {
  it("normalizes valid filters", async () => {
    const {normalizeCollaboratorFilters} =
      await import("../../src/modules/collaborators/application/use-cases/list-collaborators.use-case.js");
    const result = normalizeCollaboratorFilters({
      name: "  Ána   Silva ",
      cpf: "12345678909",
      email: " ANA@EXAMPLE.COM "
    });

    expect(result).toMatchObject({
      value: {name: "ana silva", cpf: "12345678909", email: "ana@example.com"}
    });
  });

  it("returns a modeled query failure for invalid filters", async () => {
    const {normalizeCollaboratorFilters} =
      await import("../../src/modules/collaborators/application/use-cases/list-collaborators.use-case.js");
    const result = normalizeCollaboratorFilters({cpf: "123"});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INVALID_QUERY_PARAMETER");
  });

  it("requires the filter input to be an object", async () => {
    const {normalizeCollaboratorFilters} =
      await import("../../src/modules/collaborators/application/use-cases/list-collaborators.use-case.js");
    const result = normalizeCollaboratorFilters(null as never);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INVALID_QUERY_PARAMETER");
  });
});
