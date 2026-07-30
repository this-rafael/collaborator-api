import {describe, expect, it} from "vitest";

import {DocumentTypeRepositoryStub} from "../../helpers/document-type-runtime.js";

describe("Listing document types through the application query", () => {
  // TYPE-LIST-001, TYPE-LIST-002
  it("returns primitive active document type outputs", async () => {
    const {ListDocumentTypesUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/list-document-types.use-case.js");
    const result = await new ListDocumentTypesUseCase(
      new DocumentTypeRepositoryStub() as never
    ).execute({
      filters: {},
      limit: 20
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.items).toHaveLength(1);
      expect(
        result.value.items.every((item: {deletedAt: string | null}) => item.deletedAt === null)
      ).toBe(true);
    }
  });

  // TYPE-LIST-016
  it("preserves repository availability failures", async () => {
    const {ListDocumentTypesUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/list-document-types.use-case.js");
    const result = await new ListDocumentTypesUseCase(
      DocumentTypeRepositoryStub.unavailable() as never
    ).execute({filters: {}, limit: 20});

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  // TYPE-LIST-005, TYPE-LIST-009…012
  it("rejects invalid filters and limits before querying persistence", async () => {
    const {ListDocumentTypesUseCase} =
      await import("../../../src/modules/document-types/application/use-cases/list-document-types.use-case.js");
    let calls = 0;
    const repository = {
      listActive: () => {
        calls += 1;
        return DocumentTypeRepositoryStub.unavailable().listActive();
      }
    };
    const query = new ListDocumentTypesUseCase(repository as never);
    const invalidLimit = await query.execute({filters: {}, limit: 101});
    const invalidCode = await query.execute({filters: {code: "aso"}, limit: 20});

    expect(invalidLimit.isErr()).toBe(true);
    expect(invalidCode.isErr()).toBe(true);
    if (invalidLimit.isErr()) expect(invalidLimit.error.code).toBe("INVALID_QUERY_PARAMETER");
    if (invalidCode.isErr()) expect(invalidCode.error.code).toBe("INVALID_QUERY_PARAMETER");
    expect(calls).toBe(0);
  });
});
