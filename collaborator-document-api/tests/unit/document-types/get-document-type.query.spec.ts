import {describe, expect, it} from "vitest";

import {DocumentTypeRepositoryStub} from "../../helpers/document-type-runtime.js";

describe("Getting a document type through the application query", () => {
  it("returns a primitive representation for existing active or historical types", async () => {
    const {GetDocumentTypeUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/get-document-type.use-case.js");
    const active = await new GetDocumentTypeUseCase(
      new DocumentTypeRepositoryStub() as never
    ).execute({id: "66a64ab05bd7213b90d9b010"});
    const historical = await new GetDocumentTypeUseCase(
      DocumentTypeRepositoryStub.deleted() as never
    ).execute({id: "66a64ab05bd7213b90d9b010"});

    expect(active.isOk()).toBe(true);
    expect(historical.isOk()).toBe(true);
    if (active.isOk()) expect(active.value.deletedAt).toBeNull();
    if (historical.isOk()) expect(historical.value.deletedAt).not.toBeNull();
  });

  it("returns the stable not-found failure", async () => {
    const {GetDocumentTypeUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/get-document-type.use-case.js");
    const result = await new GetDocumentTypeUseCase(
      DocumentTypeRepositoryStub.notFound() as never
    ).execute({id: "66a64ab05bd7213b90d9b099"});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("DOCUMENT_TYPE_NOT_FOUND");
  });

  it("preserves an unavailable persistence failure", async () => {
    const {GetDocumentTypeUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/get-document-type.use-case.js");
    const result = await new GetDocumentTypeUseCase(
      DocumentTypeRepositoryStub.unavailable() as never
    ).execute({id: "66a64ab05bd7213b90d9b010"});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
  });
});
