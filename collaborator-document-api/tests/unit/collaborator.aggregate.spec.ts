import {describe, expect, it} from "vitest";

import {Collaborator} from "../../src/modules/collaborators/domain/entities/collaborator.js";

const createdAt = new Date("2026-07-29T12:00:00.000Z");
const updatedAt = new Date("2026-07-29T13:00:00.000Z");
const deletedAt = new Date("2026-07-29T14:00:00.000Z");

const create = () =>
  Collaborator.create(
    {
      id: "66a64ab05bd7213b90d9b001",
      name: "Ana Silva",
      cpf: "12345678909",
      email: "ana@example.com"
    },
    createdAt
  )._unsafeUnwrap();

describe("Collaborator aggregate", () => {
  it("requires an identifier and protects its date state from external mutation", () => {
    expect(
      Collaborator.create(
        {id: "", name: "Ana Silva", cpf: "12345678909", email: "ana@example.com"},
        createdAt
      ).isErr()
    ).toBe(true);

    const collaborator = create();
    const props = collaborator.props;
    props.createdAt.setFullYear(2000);
    expect(collaborator.props.createdAt).toEqual(createdAt);
  });

  it("returns a new aggregate for update and soft-delete transitions", () => {
    const original = create();
    const updated = original.update({name: "Ana Souza"}, updatedAt)._unsafeUnwrap();
    const deleted = updated.softDelete(deletedAt)._unsafeUnwrap();

    expect(updated).not.toBe(original);
    expect(updated.props.name.value).toBe("Ana Souza");
    expect(original.props.name.value).toBe("Ana Silva");
    expect(deleted).not.toBe(updated);
    expect(deleted.deletedAt).toEqual(deletedAt);
    expect(deleted.update({name: "Outra Ana"}, deletedAt).isErr()).toBe(true);
    expect(deleted.softDelete(deletedAt)._unsafeUnwrap()).toBe(deleted);
  });

  it("rejects invalid primitive values and clock dates when creating", () => {
    const invalidDate = new Date("invalid");

    const invalidId = Collaborator.create(
      {id: 42 as never, name: "Ana Silva", cpf: "12345678909", email: "ana@example.com"},
      createdAt
    );
    const invalidNow = Collaborator.create(
      {
        id: "66a64ab05bd7213b90d9b001",
        name: "Ana Silva",
        cpf: "12345678909",
        email: "ana@example.com"
      },
      invalidDate
    );
    const invalidCpf = Collaborator.create(
      {id: "66a64ab05bd7213b90d9b001", name: "Ana Silva", cpf: "123", email: "ana@example.com"},
      createdAt
    );
    const invalidEmail = Collaborator.create(
      {id: "66a64ab05bd7213b90d9b001", name: "Ana Silva", cpf: "12345678909", email: "invalid"},
      createdAt
    );

    for (const result of [invalidId, invalidNow, invalidCpf, invalidEmail]) {
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("validates persisted dates before reconstituting the aggregate", () => {
    const props = create().props;
    const invalidUpdatedAt = Collaborator.reconstitute({...props, updatedAt: new Date("invalid")});
    const invalidDeletedAt = Collaborator.reconstitute({...props, deletedAt: new Date("invalid")});
    const reconstituted = Collaborator.reconstitute({...props, updatedAt, deletedAt});

    expect(invalidUpdatedAt.isErr()).toBe(true);
    expect(invalidDeletedAt.isErr()).toBe(true);
    if (invalidUpdatedAt.isErr()) expect(invalidUpdatedAt.error.code).toBe("VALIDATION_ERROR");
    if (invalidDeletedAt.isErr()) expect(invalidDeletedAt.error.code).toBe("VALIDATION_ERROR");
    expect(reconstituted._unsafeUnwrap().props).toMatchObject({updatedAt, deletedAt});
  });

  it("rejects malformed update patches and invalid transition dates", () => {
    const collaborator = create();
    const invalidNow = collaborator.update({name: "Ana Souza"}, new Date("invalid"));
    const invalidShape = collaborator.update(null as never, updatedAt);
    const emptyPatch = collaborator.update({}, updatedAt);
    const unknownField = collaborator.update({role: "admin"} as never, updatedAt);
    const invalidName = collaborator.update({name: ""}, updatedAt);
    const invalidCpf = collaborator.update({cpf: "123"}, updatedAt);
    const invalidEmail = collaborator.update({email: "invalid"}, updatedAt);
    const invalidDeleteDate = collaborator.softDelete(new Date("invalid"));

    for (const result of [
      invalidNow,
      invalidShape,
      emptyPatch,
      unknownField,
      invalidName,
      invalidCpf,
      invalidEmail,
      invalidDeleteDate
    ]) {
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
