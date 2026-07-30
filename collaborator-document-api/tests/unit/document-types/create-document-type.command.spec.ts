import {okAsync} from "neverthrow";
import {describe, expect, it} from "vitest";

import {DocumentTypeRepositoryStub} from "../../helpers/document-type-runtime.js";

const clock = {now: () => new Date("2026-07-30T12:00:00.000Z")};
const ids = {next: () => "66a64ab05bd7213b90d9b010"};
const input = {
  name: "Atestado de Saúde Ocupacional",
  code: "ASO",
  description: "Atestado ocupacional vigente"
};

describe("Creating a document type through the application command", () => {
  // TYPE-CREATE-001, TYPE-CREATE-002, TYPE-CREATE-003
  it("returns a primitive active document type after valid creation", async () => {
    const {CreateDocumentTypeUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/create-document-type.use-case.js");
    const result = await new CreateDocumentTypeUseCase(
      new DocumentTypeRepositoryStub() as never,
      clock,
      ids
    ).execute(input);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toMatchObject({id: ids.next(), code: "ASO", deletedAt: null});
      expect(result.value.createdAt).toBe("2026-07-30T12:00:00.000Z");
    }
  });

  // TYPE-CREATE-022
  it("preserves the stable active-code duplicate failure", async () => {
    const {CreateDocumentTypeUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/create-document-type.use-case.js");
    const result = await new CreateDocumentTypeUseCase(
      DocumentTypeRepositoryStub.duplicateCode() as never,
      clock,
      ids
    ).execute(input);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE");
  });

  // TYPE-CREATE-005…017, TYPE-CREATE-019
  it("does not call persistence when the aggregate rejects invalid input", async () => {
    const {CreateDocumentTypeUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/create-document-type.use-case.js");
    let called = false;
    const repository = {
      create: () => {
        called = true;
        return okAsync(undefined as never);
      }
    };
    const result = await new CreateDocumentTypeUseCase(repository as never, clock, ids).execute({
      ...input,
      code: "invalid"
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(called).toBe(false);
  });

  // TYPE-CREATE-024
  it("models an unavailable injected id generator as an internal failure", async () => {
    const {CreateDocumentTypeUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/create-document-type.use-case.js");
    const result = await new CreateDocumentTypeUseCase(
      new DocumentTypeRepositoryStub() as never,
      clock,
      {
        next: () => {
          throw new Error("generator unavailable");
        }
      }
    ).execute(input);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
