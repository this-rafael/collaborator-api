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

/**
 * Garante a existência dos índices normativos da coleção de tipos de documento
 * no MongoDB.
 */
@Injectable()
export class DocumentTypeIndexProvisioner {
  /**
   * @param mongoose - Serviço Ts.ED que expõe a conexão Mongoose ativa.
   */
  constructor(private readonly mongoose: MongooseService) {}

  /**
   * Cria (ou garante) os índices da coleção de tipos de documento.
   *
   * @returns Result com os nomes dos índices criados em sucesso; em falha,
   * `DocumentTypeFailure` com código `SERVICE_UNAVAILABLE` (conexão indisponível)
   * ou `INTERNAL_SERVER_ERROR` (erro ao criar índices).
   */
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

/**
 * Atalho funcional para garantir os índices sem instanciar o provisioner
 * manualmente.
 *
 * @param mongoose - Serviço Ts.ED que expõe a conexão Mongoose ativa.
 * @returns Result com os nomes dos índices criados em sucesso; em falha,
 * `DocumentTypeFailure` com código `SERVICE_UNAVAILABLE` ou `INTERNAL_SERVER_ERROR`.
 */
export const ensureDocumentTypeIndexes = (
  mongoose: MongooseService
): Promise<Result<readonly string[], DocumentTypeFailure>> =>
  new DocumentTypeIndexProvisioner(mongoose).ensure();
