import {err, ok, type Result} from "neverthrow";

import {DocumentType} from "../../src/modules/document-types/domain/entities/document-type.js";
import type {
  DocumentTypeListPage,
  DocumentTypeRepository
} from "../../src/modules/document-types/domain/repositories/document-type.repository.js";
import type {DocumentTypeFailure} from "../../src/modules/document-types/domain/errors/document-type.failure.js";

export type DocumentTypeRuntimeFailure = DocumentTypeFailure;

const fixedDocumentType = (): DocumentType =>
  DocumentType.create(
    {
      id: "66a64ab05bd7213b90d9b010",
      name: "Atestado de Saúde Ocupacional",
      code: "ASO",
      description: "Atestado ocupacional vigente"
    },
    new Date("2026-07-30T12:00:00.000Z")
  )._unsafeUnwrap();

export class DocumentTypeRepositoryStub implements DocumentTypeRepository {
  constructor(
    private readonly result: Promise<
      Result<DocumentType, DocumentTypeRuntimeFailure>
    > = Promise.resolve(ok(fixedDocumentType()))
  ) {}

  async create(): Promise<Result<DocumentType, DocumentTypeRuntimeFailure>> {
    return this.result;
  }

  async findById(): Promise<Result<DocumentType, DocumentTypeRuntimeFailure>> {
    return this.result;
  }

  async updateActive(): Promise<Result<DocumentType, DocumentTypeRuntimeFailure>> {
    return this.result;
  }

  async listActive(): Promise<Result<DocumentTypeListPage, DocumentTypeRuntimeFailure>> {
    const result = await this.result;
    if (result.isErr()) return err(result.error);
    return ok({
      items: result.value.deletedAt === null ? [result.value] : [],
      hasNext: false
    });
  }

  async softDeleteActive(): Promise<Result<boolean, DocumentTypeRuntimeFailure>> {
    return ok(true);
  }

  static unavailable(): DocumentTypeRepositoryStub {
    return new DocumentTypeRepositoryStub(
      Promise.resolve(
        err({
          kind: "application",
          code: "SERVICE_UNAVAILABLE",
          message: "Document type persistence is unavailable."
        })
      )
    );
  }

  static notFound(): DocumentTypeRepositoryStub {
    return new DocumentTypeRepositoryStub(
      Promise.resolve(
        err({
          kind: "application",
          code: "DOCUMENT_TYPE_NOT_FOUND",
          message: "Document type was not found."
        })
      )
    );
  }

  static duplicateCode(): DocumentTypeRepositoryStub {
    return new DocumentTypeRepositoryStub(
      Promise.resolve(
        err({
          kind: "application",
          code: "DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE",
          message: "An active document type already uses this code."
        })
      )
    );
  }

  static deleted(): DocumentTypeRepositoryStub {
    return new DocumentTypeRepositoryStub(
      Promise.resolve(
        ok(fixedDocumentType().softDelete(new Date("2026-07-30T13:00:00.000Z"))._unsafeUnwrap())
      )
    );
  }
}
