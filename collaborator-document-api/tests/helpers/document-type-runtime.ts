import {errAsync, okAsync, type ResultAsync} from "neverthrow";

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
    private readonly result: ResultAsync<DocumentType, DocumentTypeRuntimeFailure> = okAsync(
      fixedDocumentType()
    )
  ) {}

  create(): ResultAsync<DocumentType, DocumentTypeRuntimeFailure> {
    return this.result;
  }

  findById(): ResultAsync<DocumentType, DocumentTypeRuntimeFailure> {
    return this.result;
  }

  updateActive(): ResultAsync<DocumentType, DocumentTypeRuntimeFailure> {
    return this.result;
  }

  listActive(): ResultAsync<DocumentTypeListPage, DocumentTypeRuntimeFailure> {
    return this.result.map((value) => ({
      items: value.deletedAt === null ? [value] : [],
      hasNext: false
    }));
  }

  softDeleteActive(): ResultAsync<boolean, DocumentTypeRuntimeFailure> {
    return okAsync(true);
  }

  static unavailable(): DocumentTypeRepositoryStub {
    return new DocumentTypeRepositoryStub(
      errAsync({
        kind: "application",
        code: "SERVICE_UNAVAILABLE",
        message: "Document type persistence is unavailable."
      })
    );
  }

  static notFound(): DocumentTypeRepositoryStub {
    return new DocumentTypeRepositoryStub(
      errAsync({
        kind: "application",
        code: "DOCUMENT_TYPE_NOT_FOUND",
        message: "Document type was not found."
      })
    );
  }

  static duplicateCode(): DocumentTypeRepositoryStub {
    return new DocumentTypeRepositoryStub(
      errAsync({
        kind: "application",
        code: "DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE",
        message: "An active document type already uses this code."
      })
    );
  }

  static deleted(): DocumentTypeRepositoryStub {
    return new DocumentTypeRepositoryStub(
      okAsync(fixedDocumentType().softDelete(new Date("2026-07-30T13:00:00.000Z"))._unsafeUnwrap())
    );
  }
}
