import {Injectable} from "@tsed/di";
import {MongooseService} from "@tsed/mongoose";
import type {IndexDescription} from "mongodb";
import {err, ok, type Result} from "neverthrow";

import {
  collaboratorDocumentApplicationFailure,
  type CollaboratorDocumentFailure
} from "../../../domain/errors/collaborator-document.failure.js";
import {getCollaboratorDocumentMongoModel} from "./collaborator-document.mongo-document.js";

/** Índices normativos da coleção collaborator_documents. */
export const collaboratorDocumentIndexes: readonly IndexDescription[] = [
  {
    key: {collaboratorId: 1, documentTypeId: 1},
    name: "collaborator_documents_active_pair_unique",
    unique: true,
    partialFilterExpression: {deletedAt: null, unlinkedAt: null}
  },
  {
    key: {collaboratorId: 1, _id: 1},
    name: "collaborator_documents_collaborator_keyset"
  },
  {
    key: {documentTypeId: 1, _id: 1},
    name: "collaborator_documents_document_type_keyset"
  }
];

/** Garante a existência dos índices do módulo. */
@Injectable()
export class CollaboratorDocumentIndexProvisioner {
  constructor(private readonly mongoose: MongooseService) {}

  ensure(): Promise<Result<readonly string[], CollaboratorDocumentFailure>> {
    return this.ensureSafely();
  }

  private async ensureSafely(): Promise<Result<readonly string[], CollaboratorDocumentFailure>> {
    try {
      const connection = this.mongoose.get();
      if (connection?.readyState !== 1) {
        return err(
          collaboratorDocumentApplicationFailure(
            "SERVICE_UNAVAILABLE",
            "Collaborator document persistence is unavailable."
          )
        );
      }
      const names = await getCollaboratorDocumentMongoModel(connection).collection.createIndexes([
        ...collaboratorDocumentIndexes
      ]);
      return ok(names);
    } catch {
      return err(
        collaboratorDocumentApplicationFailure(
          "INTERNAL_SERVER_ERROR",
          "Collaborator document indexes could not be created."
        )
      );
    }
  }
}

/** Atalho para garantir índices sem instanciar o provisioner. */
export const ensureCollaboratorDocumentIndexes = (
  mongoose: MongooseService
): Promise<Result<readonly string[], CollaboratorDocumentFailure>> =>
  new CollaboratorDocumentIndexProvisioner(mongoose).ensure();
