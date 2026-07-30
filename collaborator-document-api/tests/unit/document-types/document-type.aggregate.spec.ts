import {describe, expect, it} from "vitest";

import {DocumentType} from "../../../src/modules/document-types/domain/entities/document-type.js";

const createdAt = new Date("2026-07-30T12:00:00.000Z");
const updatedAt = new Date("2026-07-30T13:00:00.000Z");
const deletedAt = new Date("2026-07-30T14:00:00.000Z");
const id = "66a64ab05bd7213b90d9b010";

const create = () =>
  DocumentType.create(
    {id, name: "Atestado", code: "ASO", description: "Descrição original"},
    createdAt
  )._unsafeUnwrap();

describe("Document type aggregate", () => {
  it("requires a valid identifier, value objects, and clock", () => {
    const results = [
      DocumentType.create({id: 42, name: "Atestado", code: "ASO", description: null}, createdAt),
      DocumentType.create({id: "   ", name: "Atestado", code: "ASO", description: null}, createdAt),
      DocumentType.create(
        {id, name: "Atestado", code: "ASO", description: null},
        new Date("invalid")
      ),
      DocumentType.create({id, name: "", code: "ASO", description: null}, createdAt),
      DocumentType.create({id, name: "Atestado", code: "aso", description: null}, createdAt)
    ];

    for (const result of results) {
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("handles omitted, null, valid, and invalid descriptions", () => {
    const omitted = DocumentType.create({id, name: "Atestado", code: "ASO"}, createdAt);
    const undefinedValue = DocumentType.create(
      {id, name: "Atestado", code: "ASO", description: undefined},
      createdAt
    );
    const nullValue = DocumentType.create(
      {id, name: "Atestado", code: "ASO", description: null},
      createdAt
    );
    const empty = DocumentType.create(
      {id, name: "Atestado", code: "ASO", description: ""},
      createdAt
    );
    const nonString = DocumentType.create(
      {id, name: "Atestado", code: "ASO", description: 42},
      createdAt
    );
    const tooLong = DocumentType.create(
      {id, name: "Atestado", code: "ASO", description: "x".repeat(1001)},
      createdAt
    );

    for (const result of [omitted, undefinedValue, nullValue, empty]) {
      expect(result.isOk()).toBe(true);
    }
    expect(omitted._unsafeUnwrap().props.description).toBeNull();
    expect(undefinedValue._unsafeUnwrap().props.description).toBeNull();
    expect(nullValue._unsafeUnwrap().props.description).toBeNull();
    expect(empty._unsafeUnwrap().props.description).toBe("");
    expect(nonString.isErr()).toBe(true);
    expect(tooLong.isErr()).toBe(true);
  });

  it("protects date state from external mutation", () => {
    const documentType = create();
    const props = documentType.props;
    props.createdAt.setFullYear(2000);

    expect(documentType.props.createdAt).toEqual(createdAt);

    const deleted = documentType.softDelete(deletedAt)._unsafeUnwrap();
    const exposedDeletedAt = deleted.deletedAt!;
    exposedDeletedAt.setFullYear(2000);
    expect(deleted.deletedAt).toEqual(deletedAt);
  });

  it("rejects malformed reconstitution state", () => {
    const props = create().props;
    const results = [
      DocumentType.reconstitute(null as never),
      DocumentType.reconstitute({...props, name: {} as never}),
      DocumentType.reconstitute({...props, code: {} as never}),
      DocumentType.reconstitute({...props, createdAt: new Date("invalid")}),
      DocumentType.reconstitute({...props, updatedAt: new Date("invalid")}),
      DocumentType.reconstitute({...props, deletedAt: new Date("invalid")}),
      DocumentType.reconstitute({...props, description: 42 as never}),
      DocumentType.reconstitute({...props, description: "x".repeat(1001)}),
      DocumentType.reconstitute({...props, id: " "})
    ];

    for (const result of results) {
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("restores valid updated, deleted, and description state", () => {
    const result = DocumentType.reconstitute({
      ...create().props,
      description: null,
      updatedAt,
      deletedAt
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().props).toMatchObject({description: null, updatedAt, deletedAt});
  });

  it("rejects malformed updates and invalid transition dates", () => {
    const documentType = create();
    const results = [
      documentType.update({name: "Novo nome"}, new Date("invalid")),
      documentType.update(null as never, updatedAt),
      documentType.update([] as never, updatedAt),
      documentType.update({}, updatedAt),
      documentType.update({unknown: true} as never, updatedAt),
      documentType.update({name: ""}, updatedAt),
      documentType.update({code: "aso"}, updatedAt),
      documentType.update({description: undefined}, updatedAt),
      documentType.update({description: 42}, updatedAt),
      documentType.update({description: "x".repeat(1001)}, updatedAt),
      documentType.softDelete(new Date("invalid"))
    ];

    for (const result of results) {
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("returns new aggregates for valid updates and idempotent deletion", () => {
    const original = create();
    const retained = original
      .update({name: undefined, code: undefined, description: null}, updatedAt)
      ._unsafeUnwrap();
    const renamed = retained.update({name: "Laudo", code: "LDO"}, deletedAt)._unsafeUnwrap();
    const deleted = renamed.softDelete(deletedAt)._unsafeUnwrap();

    expect(retained).not.toBe(original);
    expect(retained.props).toMatchObject({
      name: original.props.name,
      code: original.props.code,
      description: null,
      updatedAt
    });
    expect(renamed.props.name.value).toBe("Laudo");
    expect(renamed.props.code.value).toBe("LDO");
    expect(deleted.deletedAt).toEqual(deletedAt);
    expect(deleted.update({name: "Outro"}, deletedAt).isErr()).toBe(true);
    expect(deleted.softDelete(deletedAt)._unsafeUnwrap()).toBe(deleted);
  });
});
