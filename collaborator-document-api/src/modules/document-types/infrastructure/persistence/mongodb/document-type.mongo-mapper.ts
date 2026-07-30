import {err, ok, type Result} from "neverthrow";
import {Types} from "mongoose";

import {DocumentType} from "../../../domain/entities/document-type.js";
import {
  documentTypeApplicationFailure,
  type DocumentTypeFailure
} from "../../../domain/errors/document-type.failure.js";
import {DocumentTypeCode} from "../../../domain/value-objects/document-type-code.js";
import {DocumentTypeName} from "../../../domain/value-objects/document-type-name.js";
import type {DocumentTypeMongoDocument} from "./document-type.mongo-document.js";

export type DocumentTypeMongoWrite = DocumentTypeMongoDocument & Readonly<{_id: Types.ObjectId}>;

export type DocumentTypeMongoRead = Partial<DocumentTypeMongoDocument> &
  Readonly<{_id?: {toString(): string}; id?: string}>;

export const normalizeDocumentTypeName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");

export const documentTypeToMongoDocument = (
  documentType: DocumentType
): Result<DocumentTypeMongoWrite, DocumentTypeFailure> => {
  const {id, name, code, description, createdAt, updatedAt, deletedAt} = documentType.props;
  if (!Types.ObjectId.isValid(id)) {
    return err(
      documentTypeApplicationFailure(
        "INTERNAL_SERVER_ERROR",
        "Generated document type id is invalid."
      )
    );
  }

  return ok({
    _id: new Types.ObjectId(id),
    name: name.value,
    nameNormalized: normalizeDocumentTypeName(name.value),
    code: code.value,
    description,
    createdAt,
    updatedAt,
    deletedAt
  });
};

export const documentTypeFromMongoDocument = (
  value: DocumentTypeMongoRead
): Result<DocumentType, DocumentTypeFailure> => {
  const id = value._id?.toString() ?? value.id;
  if (
    !id ||
    typeof value.name !== "string" ||
    typeof value.code !== "string" ||
    !(value.createdAt instanceof Date) ||
    !(value.updatedAt instanceof Date) ||
    (value.deletedAt !== null &&
      value.deletedAt !== undefined &&
      !(value.deletedAt instanceof Date)) ||
    (value.description !== null &&
      value.description !== undefined &&
      typeof value.description !== "string")
  ) {
    return err(
      documentTypeApplicationFailure(
        "INTERNAL_SERVER_ERROR",
        "Document type persistence data is invalid."
      )
    );
  }

  const name = DocumentTypeName.create(value.name);
  const code = DocumentTypeCode.create(value.code);
  if (name.isErr() || code.isErr()) {
    return err(
      documentTypeApplicationFailure(
        "INTERNAL_SERVER_ERROR",
        "Document type persistence data is invalid."
      )
    );
  }

  return DocumentType.reconstitute({
    id,
    name: name.value,
    code: code.value,
    description: value.description ?? null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    deletedAt: value.deletedAt ?? null
  }).mapErr(() =>
    documentTypeApplicationFailure(
      "INTERNAL_SERVER_ERROR",
      "Document type persistence data is invalid."
    )
  );
};
