import {err, ok, type Result} from "neverthrow";
import {Types} from "mongoose";

import type {CollaboratorDocumentOutput} from "../../../application/contracts/collaborator-document-output.js";
import {CollaboratorDocument} from "../../../domain/aggregates/collaborator-document.js";
import {
  collaboratorDocumentApplicationFailure,
  type CollaboratorDocumentFailure
} from "../../../domain/errors/collaborator-document.failure.js";
import type {CollaboratorDocumentMongoDocument} from "./collaborator-document.mongo-document.js";

/** Formato de escrita no MongoDB. */
export type CollaboratorDocumentMongoWrite = CollaboratorDocumentMongoDocument &
  Readonly<{_id: Types.ObjectId}>;

/** Formato de leitura no MongoDB. */
export type CollaboratorDocumentMongoRead = Partial<CollaboratorDocumentMongoDocument> &
  Readonly<{_id?: {toString(): string}; id?: string}>;

/** Converte o agregado para documento Mongo de escrita. */
export const collaboratorDocumentToMongoDocument = (
  document: CollaboratorDocument
): Result<CollaboratorDocumentMongoWrite, CollaboratorDocumentFailure> => {
  const props = document.props;
  if (!Types.ObjectId.isValid(props.id)) {
    return err(
      collaboratorDocumentApplicationFailure(
        "INTERNAL_SERVER_ERROR",
        "Generated collaborator document id is invalid."
      )
    );
  }

  return ok({
    _id: new Types.ObjectId(props.id),
    collaboratorId: props.collaboratorId,
    documentTypeId: props.documentTypeId,
    status: props.status,
    currentVersion: props.currentVersion,
    versions: [...props.versions],
    lastSubmittedAt: props.lastSubmittedAt,
    linkedAt: props.linkedAt,
    unlinkedAt: props.unlinkedAt,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
    deletedAt: props.deletedAt
  });
};

/** Reconstrói o agregado a partir de um documento Mongo. */
export const collaboratorDocumentFromMongoDocument = (
  value: CollaboratorDocumentMongoRead
): Result<CollaboratorDocument, CollaboratorDocumentFailure> => {
  const id = value._id?.toString() ?? value.id;
  if (
    !id ||
    typeof value.collaboratorId !== "string" ||
    typeof value.documentTypeId !== "string" ||
    (value.status !== "PENDING" && value.status !== "SUBMITTED") ||
    typeof value.currentVersion !== "number" ||
    !Array.isArray(value.versions) ||
    !(value.linkedAt instanceof Date) ||
    !(value.createdAt instanceof Date) ||
    !(value.updatedAt instanceof Date) ||
    (value.lastSubmittedAt !== null &&
      value.lastSubmittedAt !== undefined &&
      !(value.lastSubmittedAt instanceof Date)) ||
    (value.unlinkedAt !== null &&
      value.unlinkedAt !== undefined &&
      !(value.unlinkedAt instanceof Date)) ||
    (value.deletedAt !== null &&
      value.deletedAt !== undefined &&
      !(value.deletedAt instanceof Date))
  ) {
    return err(
      collaboratorDocumentApplicationFailure(
        "INTERNAL_SERVER_ERROR",
        "Collaborator document persistence data is invalid."
      )
    );
  }

  const document = CollaboratorDocument.reconstitute({
    id,
    collaboratorId: value.collaboratorId,
    documentTypeId: value.documentTypeId,
    status: value.status,
    currentVersion: value.currentVersion,
    versions: value.versions as CollaboratorDocument["props"]["versions"],
    lastSubmittedAt: value.lastSubmittedAt ?? null,
    linkedAt: value.linkedAt,
    unlinkedAt: value.unlinkedAt ?? null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    deletedAt: value.deletedAt ?? null
  });
  if (document.isErr()) {
    return err(
      collaboratorDocumentApplicationFailure(
        "INTERNAL_SERVER_ERROR",
        "Collaborator document persistence data is invalid."
      )
    );
  }
  return document;
};

/** Converte leitura Mongo para saída primitiva da aplicação. */
export const collaboratorDocumentOutputFromMongoDocument = (
  value: CollaboratorDocumentMongoRead
): Result<CollaboratorDocumentOutput, CollaboratorDocumentFailure> => {
  const document = collaboratorDocumentFromMongoDocument(value);
  if (document.isErr()) return err(document.error);
  const props = document.value.props;
  return ok(
    Object.freeze({
      id: props.id,
      collaboratorId: props.collaboratorId,
      documentTypeId: props.documentTypeId,
      status: props.status,
      currentVersion: props.currentVersion,
      versions: props.versions,
      lastSubmittedAt: props.lastSubmittedAt?.toISOString() ?? null,
      linkedAt: props.linkedAt.toISOString(),
      unlinkedAt: props.unlinkedAt?.toISOString() ?? null,
      createdAt: props.createdAt.toISOString(),
      updatedAt: props.updatedAt.toISOString(),
      deletedAt: props.deletedAt?.toISOString() ?? null,
      versionCount: props.versions.length
    })
  );
};
