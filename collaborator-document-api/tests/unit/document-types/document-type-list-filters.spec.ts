import {describe, expect, it} from "vitest";

describe("Normalizing document type list filters", () => {
  // TYPE-LIST-003, TYPE-LIST-004
  it("normalizes a partial name while preserving an exact uppercase code", async () => {
    const {normalizeDocumentTypeFilters} =
      await import("../../../src/modules/document-types/application/use-cases/list-document-types.use-case.js");
    const result = normalizeDocumentTypeFilters({
      name: "  Átestado   OCUPACIONAL ",
      code: "ASO"
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({name: "atestado ocupacional", code: "ASO"});
    }
  });

  // TYPE-LIST-005
  it.each(["aso", "A", "1ASO", "ASO-TEST", 42 as unknown])(
    "returns a modeled query failure for invalid code filters",
    async (code) => {
      const {normalizeDocumentTypeFilters} =
        await import("../../../src/modules/document-types/application/use-cases/list-document-types.use-case.js");
      const result = normalizeDocumentTypeFilters({code: code as string});

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("INVALID_QUERY_PARAMETER");
        expect(result.error.kind === "application" ? result.error.errors : undefined).toEqual(
          expect.arrayContaining([expect.objectContaining({field: "code"})])
        );
      }
    }
  );

  it("requires the filter input to be an object", async () => {
    const {normalizeDocumentTypeFilters} =
      await import("../../../src/modules/document-types/application/use-cases/list-document-types.use-case.js");
    const result = normalizeDocumentTypeFilters(null as never);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("INVALID_QUERY_PARAMETER");
  });
});
