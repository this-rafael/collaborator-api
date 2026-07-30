import {Injectable} from "@tsed/di";
import {MongooseService} from "@tsed/mongoose";
import type {IndexDescription} from "mongodb";
import {err, ok, type Result} from "neverthrow";

import {
  documentTypeApplicationFailure,
  type DocumentTypeFailure
} from "../../../domain/errors/document-type.failure.js";
import {getDocumentTypeMongoModel} from "./document-type.mongo-document.js";

/** Definições de índices normativos para a coleção de tipos de documento. */
export const documentTypeIndexes: readonly IndexDescription[] = [
  {
    key: {code: 1},
    name: "document_types_active_code_unique",
    unique: true,
    partialFilterExpression: {deletedAt: null}
  },
  {
    key: {deletedAt: 1, _id: 1},
    name: "document_types_active_keyset",
    partialFilterExpression: {deletedAt: null}
  }
];

/** Garante a existência dos índices de tipos de documento no MongoDB. */
@Injectable()
export class DocumentTypeIndexProvisioner {
  constructor(private readonly mongoose: MongooseService) {}

  ensure(): Promise<Result<readonly string[], DocumentTypeFailure>> {
    return this.ensureSafely();
  }

  private async ensureSafely(): Promise<Result<readonly string[], DocumentTypeFailure>> {
    try {
      const connection = this.mongoose.get();
      if (connection?.readyState !== 1) {
        return err(
          documentTypeApplicationFailure(
            "SERVICE_UNAVAILABLE",
            "Document type persistence is unavailable."
          )
        );
      }
      const names = await getDocumentTypeMongoModel(connection).collection.createIndexes([
        ...documentTypeIndexes
      ]);
      return ok(names);
    } catch {
      return err(
        documentTypeApplicationFailure(
          "INTERNAL_SERVER_ERROR",
          "Document type indexes could not be created."
        )
      );
    }
  }
}

/** Atalho para garantir índices sem instanciar o provisioner. */
export const ensureDocumentTypeIndexes = (
  mongoose: MongooseService
): Promise<Result<readonly string[], DocumentTypeFailure>> =>
  new DocumentTypeIndexProvisioner(mongoose).ensure();
