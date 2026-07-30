import {err, ok} from "neverthrow";
import {describe, expect, it} from "vitest";

type TestTransactionContext = Readonly<{opaque: true}>;

const id = "66a64ab05bd7213b90d9b010";
const clock = {now: () => new Date("2026-07-30T13:00:00.000Z")};

describe("Deleting a document type through the application command", () => {
  // TYPE-DELETE-001
  it("uses one opaque transaction for the type and document cascade", async () => {
    const {DocumentType} =
      await import("../../../src/modules/document-types/domain/entities/document-type.js");
    const {DeleteDocumentTypeUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/delete-document-type.use-case.js");
    const active = DocumentType.create(
      {id, name: "Atestado", code: "ASO", description: null},
      new Date("2026-07-30T12:00:00.000Z")
    )._unsafeUnwrap();
    const context = {opaque: true} as const;
    let repositoryContext: TestTransactionContext | undefined;
    let cascadeContext: TestTransactionContext | undefined;
    let cascadeInput: {documentTypeId: string; deletedAt: string} | undefined;
    const repository = {
      findById: () => Promise.resolve(ok(active)),
      softDeleteActive: (_entity: unknown, transaction: TestTransactionContext) => {
        repositoryContext = transaction;
        return Promise.resolve(ok(true));
      }
    };
    const documents = {
      execute: (
        input: {documentTypeId: string; deletedAt: string},
        transaction: TestTransactionContext
      ) => {
        cascadeInput = input;
        cascadeContext = transaction;
        return Promise.resolve(ok(undefined));
      }
    };
    const transactions = {
      execute: (work: (transaction: TestTransactionContext) => Promise<unknown>) => work(context)
    };

    const result = await new DeleteDocumentTypeUseCase(
      repository as never,
      documents as never,
      transactions as never,
      clock
    ).execute({id});
    expect(result.isOk()).toBe(true);
    expect(repositoryContext).toBe(context);
    expect(cascadeContext).toBe(context);
    expect(cascadeInput).toEqual({
      documentTypeId: id,
      deletedAt: "2026-07-30T13:00:00.000Z"
    });
  });

  // TYPE-DELETE-002
  it("propagates a modeled cascade failure so the transaction can roll back", async () => {
    const {DocumentType} =
      await import("../../../src/modules/document-types/domain/entities/document-type.js");
    const {DeleteDocumentTypeUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/delete-document-type.use-case.js");
    const active = DocumentType.create(
      {id, name: "Atestado", code: "ASO", description: null},
      new Date("2026-07-30T12:00:00.000Z")
    )._unsafeUnwrap();
    const repository = {
      findById: () => Promise.resolve(ok(active)),
      softDeleteActive: () => Promise.resolve(ok(true))
    };
    const documents = {
      execute: () =>
        Promise.resolve(
          err({
            kind: "application" as const,
            code: "SERVICE_UNAVAILABLE" as const,
            message: "Document cascade unavailable."
          })
        )
    };
    const transactions = {
      execute: (work: (transaction: TestTransactionContext) => Promise<unknown>) =>
        work({opaque: true})
    };
    const result = await new DeleteDocumentTypeUseCase(
      repository as never,
      documents as never,
      transactions as never,
      clock
    ).execute({id});
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  // TYPE-DELETE-003
  it("does not cascade when the type was already deleted concurrently", async () => {
    const {DocumentType} =
      await import("../../../src/modules/document-types/domain/entities/document-type.js");
    const {DeleteDocumentTypeUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/delete-document-type.use-case.js");
    const active = DocumentType.create(
      {id, name: "Atestado", code: "ASO", description: null},
      new Date("2026-07-30T12:00:00.000Z")
    )._unsafeUnwrap();
    let cascaded = false;
    const repository = {
      findById: () => Promise.resolve(ok(active)),
      softDeleteActive: () => Promise.resolve(ok(false))
    };
    const documents = {
      execute: () => {
        cascaded = true;
        return Promise.resolve(ok(undefined));
      }
    };
    const transactions = {
      execute: (work: (transaction: TestTransactionContext) => Promise<unknown>) =>
        work({opaque: true})
    };
    const result = await new DeleteDocumentTypeUseCase(
      repository as never,
      documents as never,
      transactions as never,
      clock
    ).execute({id});
    expect(result.isOk()).toBe(true);
    expect(cascaded).toBe(false);
  });

  // TYPE-DELETE-008, TX-003
  it("preserves transaction service unavailability", async () => {
    const {DocumentType} =
      await import("../../../src/modules/document-types/domain/entities/document-type.js");
    const {DeleteDocumentTypeUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/delete-document-type.use-case.js");
    const active = DocumentType.create(
      {id, name: "Atestado", code: "ASO", description: null},
      new Date("2026-07-30T12:00:00.000Z")
    )._unsafeUnwrap();
    const repository = {
      findById: () => Promise.resolve(ok(active)),
      softDeleteActive: () => Promise.resolve(ok(true))
    };
    const documents = {execute: () => Promise.resolve(ok(undefined))};
    const transactions = {
      execute: () =>
        Promise.resolve(
          err({
            kind: "application" as const,
            code: "SERVICE_UNAVAILABLE" as const,
            message: "Transaction retries exhausted."
          })
        )
    };
    const result = await new DeleteDocumentTypeUseCase(
      repository as never,
      documents as never,
      transactions as never,
      clock
    ).execute({id});
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("does not start deletion when the clock is unavailable", async () => {
    const {DocumentType} =
      await import("../../../src/modules/document-types/domain/entities/document-type.js");
    const {DeleteDocumentTypeUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/delete-document-type.use-case.js");
    const active = DocumentType.create(
      {id, name: "Atestado", code: "ASO", description: null},
      new Date("2026-07-30T12:00:00.000Z")
    )._unsafeUnwrap();
    let transactionStarted = false;
    const repository = {
      findById: () => Promise.resolve(ok(active)),
      softDeleteActive: () => Promise.resolve(ok(true))
    };
    const documents = {execute: () => Promise.resolve(ok(undefined))};
    const transactions = {
      execute: () => {
        transactionStarted = true;
        return Promise.resolve(ok(undefined));
      }
    };

    const result = await new DeleteDocumentTypeUseCase(
      repository as never,
      documents as never,
      transactions as never,
      {
        now: () => {
          throw new Error("clock unavailable");
        }
      }
    ).execute({id});
    const invalidNow = await new DeleteDocumentTypeUseCase(
      repository as never,
      documents as never,
      transactions as never,
      {now: () => new Date("invalid")}
    ).execute({id});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(invalidNow.isErr()).toBe(true);
    if (invalidNow.isErr()) expect(invalidNow.error.code).toBe("VALIDATION_ERROR");
    expect(transactionStarted).toBe(false);
  });
});
