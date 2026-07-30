import {errAsync, okAsync, type ResultAsync} from "neverthrow";

export interface DocumentTypeRuntimeEntity {
  id: string;
  name: string;
  code: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface DocumentTypeRuntimePage {
  items: DocumentTypeRuntimeEntity[];
  hasNext: boolean;
}

export type DocumentTypeRuntimeFailure =
  | {
      kind: "application";
      code:
        | "DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE"
        | "DOCUMENT_TYPE_NOT_FOUND"
        | "DOCUMENT_TYPE_DELETED"
        | "SERVICE_UNAVAILABLE"
        | "INTERNAL_SERVER_ERROR";
      message: string;
    }
  | {kind: "domain"; code: "VALIDATION_ERROR"; message: string};

const activeEntity = (): DocumentTypeRuntimeEntity => ({
  id: "66a64ab05bd7213b90d9b010",
  name: "Atestado de Saúde Ocupacional",
  code: "ASO",
  description: "Atestado ocupacional vigente",
  createdAt: new Date("2026-07-30T12:00:00.000Z"),
  updatedAt: new Date("2026-07-30T12:00:00.000Z"),
  deletedAt: null
});

export class DocumentTypeRepositoryStub {
  constructor(
    private readonly result: ResultAsync<
      DocumentTypeRuntimeEntity,
      DocumentTypeRuntimeFailure
    > = okAsync(activeEntity())
  ) {}

  create(
    entity?: DocumentTypeRuntimeEntity
  ): ResultAsync<DocumentTypeRuntimeEntity, DocumentTypeRuntimeFailure> {
    return entity ? okAsync(entity) : this.result;
  }

  findById(): ResultAsync<DocumentTypeRuntimeEntity, DocumentTypeRuntimeFailure> {
    return this.result;
  }

  updateActive(
    entity?: DocumentTypeRuntimeEntity
  ): ResultAsync<DocumentTypeRuntimeEntity, DocumentTypeRuntimeFailure> {
    return entity ? okAsync(entity) : this.result;
  }

  listActive(): ResultAsync<DocumentTypeRuntimePage, DocumentTypeRuntimeFailure> {
    return this.result.map((value) => ({
      items: value.deletedAt === null ? [value] : [],
      hasNext: false
    }));
  }

  softDeleteActive(): ResultAsync<boolean, DocumentTypeRuntimeFailure> {
    return this.result.map((value) => value.deletedAt === null);
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

  static notFound(): DocumentTypeRepositoryStub {
    return new DocumentTypeRepositoryStub(
      errAsync({
        kind: "application",
        code: "DOCUMENT_TYPE_NOT_FOUND",
        message: "Document type was not found."
      })
    );
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

  static deleted(): DocumentTypeRepositoryStub {
    return new DocumentTypeRepositoryStub(
      okAsync({...activeEntity(), deletedAt: new Date("2026-07-30T13:00:00.000Z")})
    );
  }
}
