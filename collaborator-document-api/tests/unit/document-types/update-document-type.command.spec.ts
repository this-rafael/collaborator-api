import {errAsync, okAsync} from "neverthrow";
import {describe, expect, it} from "vitest";

const id = "66a64ab05bd7213b90d9b010";
const clock = {now: () => new Date("2026-07-30T13:00:00.000Z")};

describe("Updating a document type through the application command", () => {
  // TYPE-PATCH-001…004
  it("applies only present fields and treats a null description as a clear operation", async () => {
    const {DocumentType} =
      await import("../../../src/modules/document-types/domain/entities/document-type.js");
    const {UpdateDocumentTypeUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/update-document-type.use-case.js");
    const existing = DocumentType.create(
      {id, name: "Atestado", code: "ASO", description: "Descrição original"},
      new Date("2026-07-30T12:00:00.000Z")
    )._unsafeUnwrap();
    let persisted: unknown;
    const repository = {
      findById: () => okAsync(existing),
      updateActive: (entity: unknown) => {
        persisted = entity;
        return okAsync(entity);
      }
    };

    const result = await new UpdateDocumentTypeUseCase(repository as never, clock).execute({
      id,
      patch: {name: "Atestado Ocupacional", description: null}
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toMatchObject({
        name: "Atestado Ocupacional",
        code: "ASO",
        description: null
      });
      expect(result.value.updatedAt).toBe("2026-07-30T13:00:00.000Z");
    }
    expect(persisted).toBeDefined();
  });

  // TYPE-PATCH-006…010
  it("does not persist a partial update rejected by value objects", async () => {
    const {DocumentType} =
      await import("../../../src/modules/document-types/domain/entities/document-type.js");
    const {UpdateDocumentTypeUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/update-document-type.use-case.js");
    const existing = DocumentType.create(
      {id, name: "Atestado", code: "ASO", description: null},
      new Date("2026-07-30T12:00:00.000Z")
    )._unsafeUnwrap();
    let persisted = false;
    const repository = {
      findById: () => okAsync(existing),
      updateActive: () => {
        persisted = true;
        return okAsync(existing);
      }
    };
    const result = await new UpdateDocumentTypeUseCase(repository as never, clock).execute({
      id,
      patch: {code: "aso"}
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(persisted).toBe(false);
  });

  // TYPE-PATCH-014
  it("preserves the active-code duplicate failure from persistence", async () => {
    const {DocumentType} =
      await import("../../../src/modules/document-types/domain/entities/document-type.js");
    const {UpdateDocumentTypeUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/update-document-type.use-case.js");
    const existing = DocumentType.create(
      {id, name: "Atestado", code: "ASO", description: null},
      new Date("2026-07-30T12:00:00.000Z")
    )._unsafeUnwrap();
    const repository = {
      findById: () => okAsync(existing),
      updateActive: () =>
        errAsync({
          kind: "application" as const,
          code: "DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE" as const,
          message: "Duplicate code."
        })
    };
    const result = await new UpdateDocumentTypeUseCase(repository as never, clock).execute({
      id,
      patch: {code: "CTPS"}
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE");
  });

  // TYPE-PATCH-015
  it("refuses to mutate a deleted document type", async () => {
    const {DocumentType} =
      await import("../../../src/modules/document-types/domain/entities/document-type.js");
    const {UpdateDocumentTypeUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/update-document-type.use-case.js");
    const existing = DocumentType.create(
      {id, name: "Atestado", code: "ASO", description: null},
      new Date("2026-07-30T12:00:00.000Z")
    )
      ._unsafeUnwrap()
      .softDelete(new Date("2026-07-30T12:30:00.000Z"))
      ._unsafeUnwrap();
    let persisted = false;
    const repository = {
      findById: () => okAsync(existing),
      updateActive: () => {
        persisted = true;
        return okAsync(existing);
      }
    };
    const result = await new UpdateDocumentTypeUseCase(repository as never, clock).execute({
      id,
      patch: {name: "Novo nome"}
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("DOCUMENT_TYPE_DELETED");
    expect(persisted).toBe(false);
  });
});
