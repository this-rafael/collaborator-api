import {describe, expect, it} from "vitest";

describe("Document type value objects", () => {
  it("accepts normalized names and canonical code boundaries", async () => {
    const {DocumentTypeName} =
      await import("../../../src/modules/document-types/domain/value-objects/document-type-name.js");
    const {DocumentTypeCode} =
      await import("../../../src/modules/document-types/domain/value-objects/document-type-code.js");

    const name = DocumentTypeName.create("  Átestado   Ocupacional ");
    expect(name.isOk()).toBe(true);
    if (name.isOk()) expect(name.value.value).toBe("Átestado Ocupacional");
    expect(DocumentTypeCode.create("AB").isOk()).toBe(true);
    expect(DocumentTypeCode.create(`A${"B".repeat(63)}`).isOk()).toBe(true);
  });

  it.each(["", "a".repeat(201), 12, null])("rejects invalid document type names", async (value) => {
    const {DocumentTypeName} =
      await import("../../../src/modules/document-types/domain/value-objects/document-type-name.js");
    expect(DocumentTypeName.create(value).isErr()).toBe(true);
  });

  it.each(["A", `A${"B".repeat(64)}`, "1ASO", "aso", "ASO TEST", "ASO-TEST", 42, null])(
    "rejects invalid document type codes",
    async (value) => {
      const {DocumentTypeCode} =
        await import("../../../src/modules/document-types/domain/value-objects/document-type-code.js");
      expect(DocumentTypeCode.create(value).isErr()).toBe(true);
    }
  );

  it.each(["a".repeat(1001), 42, false, [], {}])(
    "rejects invalid document type descriptions through the aggregate",
    async (description) => {
      const {DocumentType} =
        await import("../../../src/modules/document-types/domain/entities/document-type.js");
      expect(
        DocumentType.create(
          {
            id: "66a64ab05bd7213b90d9b010",
            name: "Atestado",
            code: "ASO",
            description
          },
          new Date("2026-07-30T12:00:00.000Z")
        ).isErr()
      ).toBe(true);
    }
  );
});
