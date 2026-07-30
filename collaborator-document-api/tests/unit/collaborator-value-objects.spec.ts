import {describe, expect, it} from "vitest";

describe("Collaborator value objects", () => {
  it("accepts normalized valid values", async () => {
    const {CollaboratorName} =
      await import("../../src/modules/collaborators/domain/value-objects/collaborator-name.js");
    const {Cpf} = await import("../../src/modules/collaborators/domain/value-objects/cpf.js");
    const {Email} = await import("../../src/modules/collaborators/domain/value-objects/email.js");

    expect(CollaboratorName.create("  Ana   Silva ").isOk()).toBe(true);
    expect(Cpf.create("12345678909").isOk()).toBe(true);
    expect(Email.create(" ANA@example.com ").isOk()).toBe(true);
  });

  it.each(["", "a".repeat(201), 12, null])("rejects invalid names", async (value) => {
    const {CollaboratorName} =
      await import("../../src/modules/collaborators/domain/value-objects/collaborator-name.js");
    expect(CollaboratorName.create(value).isErr()).toBe(true);
  });

  it.each(["123", "1".repeat(12), "123.456.789-09", "abcdefghijk", 12345678909])(
    "rejects invalid CPF values",
    async (value) => {
      const {Cpf} = await import("../../src/modules/collaborators/domain/value-objects/cpf.js");
      expect(Cpf.create(value).isErr()).toBe(true);
    }
  );

  it.each(["invalid", `${"a".repeat(310)}@x.com`, 42])("rejects invalid emails", async (value) => {
    const {Email} = await import("../../src/modules/collaborators/domain/value-objects/email.js");
    expect(Email.create(value).isErr()).toBe(true);
  });
});
