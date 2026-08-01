import {Injectable} from "@tsed/di";
import {MongooseService} from "@tsed/mongoose";
import {err, ok, type Result} from "neverthrow";
import {Types, type Connection} from "mongoose";

import type {
  DocumentTypeListPage,
  DocumentTypeRepository
} from "../../../domain/repositories/document-type.repository.js";
import type {TransactionContext} from "../../../../../shared/domain/transaction-context.js";
import {DocumentType} from "../../../domain/entities/document-type.js";
import {
  documentTypeApplicationFailure,
  documentTypeDomainFailure,
  type DocumentTypeFailure
} from "../../../domain/errors/document-type.failure.js";
import {documentTypeNotFoundFailure} from "../../../domain/errors/document-type-not-found.failure.js";
import {getMongoSession} from "../../../../../shared/infrastructure/persistence/mongodb/mongo-transaction-context.js";
import {
  documentTypeFromMongoDocument,
  documentTypeToMongoDocument,
  normalizeDocumentTypeName,
  type DocumentTypeMongoRead
} from "./document-type.mongo-mapper.js";
import {getDocumentTypeMongoModel} from "./document-type.mongo-document.js";

const unavailable = (): DocumentTypeFailure =>
  documentTypeApplicationFailure(
    "SERVICE_UNAVAILABLE",
    "Document type persistence is unavailable."
  );

/**
 * Implementação MongoDB (adaptador de saída) do repositório de tipos de documento.
 *
 * @remarks
 * Todas as operações capturam erros de infraestrutura e os traduzem em
 * `DocumentTypeFailure` via `Result`, sem lançar erros de negócio.
 */
@Injectable()
export class MongoDocumentTypeRepository implements DocumentTypeRepository {
  /**
   * @param mongoose - Serviço Ts.ED que expõe a conexão Mongoose ativa.
   */
  constructor(private readonly mongoose: MongooseService) {}

  /**
   * Persiste um novo tipo de documento.
   *
   * @param documentType - Agregado já validado a ser persistido.
   * @returns Result com o tipo persistido em sucesso; em falha,
   * `DocumentTypeFailure` com códigos `DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE`,
   * `SERVICE_UNAVAILABLE` ou `INTERNAL_SERVER_ERROR`.
   */
  create(documentType: DocumentType): Promise<Result<DocumentType, DocumentTypeFailure>> {
    return this.createSafely(documentType);
  }

  /**
   * Recupera um tipo de documento pelo identificador.
   *
   * @param id - Identificador (ObjectId em formato string) do tipo.
   * @returns Result com o tipo encontrado em sucesso; em falha,
   * `DocumentTypeFailure` com códigos `VALIDATION_ERROR` (id inválido),
   * `DOCUMENT_TYPE_NOT_FOUND`, `SERVICE_UNAVAILABLE` ou `INTERNAL_SERVER_ERROR`.
   */
  findById(id: string): Promise<Result<DocumentType, DocumentTypeFailure>> {
    return this.findByIdSafely(id);
  }

  /**
   * Lista tipos de documento ativos com filtros e paginação keyset por `_id`.
   *
   * @param input - Parâmetros da listagem (`filters` opcionais por nome/código,
   *   `afterId` cursor opcional, `limit` quantidade máxima).
   * @returns Result com a página de resultados em sucesso; em falha,
   * `DocumentTypeFailure` com códigos `INVALID_QUERY_PARAMETER` (cursor inválido),
   * `SERVICE_UNAVAILABLE` ou `INTERNAL_SERVER_ERROR`.
   */
  listActive(input: {
    filters: {name?: string; code?: string};
    afterId?: string;
    limit: number;
  }): Promise<Result<DocumentTypeListPage, DocumentTypeFailure>> {
    return this.listActiveSafely(input);
  }

  /**
   * Atualiza um tipo de documento ativo.
   *
   * @param documentType - Agregado já atualizado a ser persistido.
   * @returns Result com o tipo atualizado em sucesso; em falha,
   * `DocumentTypeFailure` com códigos `DOCUMENT_TYPE_NOT_FOUND`,
   * `DOCUMENT_TYPE_DELETED`, `DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE`,
   * `SERVICE_UNAVAILABLE` ou `INTERNAL_SERVER_ERROR`.
   */
  updateActive(documentType: DocumentType): Promise<Result<DocumentType, DocumentTypeFailure>> {
    return this.updateActiveSafely(documentType);
  }

  /**
   * Aplica soft delete a um tipo de documento ativo dentro de uma transação.
   *
   * @param documentType - Agregado a ser marcado como excluído.
   * @param context - Contexto transacional que fornece a sessão Mongo.
   * @returns Result com `true` quando um documento foi efetivamente marcado
   * (`false` se nada foi alterado) em sucesso; em falha, `DocumentTypeFailure`
   * com códigos `SERVICE_UNAVAILABLE` ou `INTERNAL_SERVER_ERROR`.
   */
  softDeleteActive(
    documentType: DocumentType,
    context: TransactionContext
  ): Promise<Result<boolean, DocumentTypeFailure>> {
    return this.softDeleteActiveSafely(documentType, context);
  }

  private connection(): Connection | undefined {
    try {
      const connection = this.mongoose.get();
      return connection?.readyState === 1 ? connection : undefined;
    } catch {
      return undefined;
    }
  }

  private async createSafely(
    documentType: DocumentType
  ): Promise<Result<DocumentType, DocumentTypeFailure>> {
    const model = this.model();
    const document = documentTypeToMongoDocument(documentType);
    if (!model) return err(unavailable());
    if (document.isErr()) return err(document.error);

    try {
      const created = await model.create(document.value);
      return documentTypeFromMongoDocument(created.toObject() as DocumentTypeMongoRead);
    } catch (error) {
      return err(mapMongoFailure(error));
    }
  }

  private async findByIdSafely(id: string): Promise<Result<DocumentType, DocumentTypeFailure>> {
    const model = this.model();
    if (!model) return err(unavailable());
    if (!Types.ObjectId.isValid(id)) {
      return err(documentTypeDomainFailure("VALIDATION_ERROR", "document type id is invalid"));
    }

    try {
      const row = await model.findById(id).lean();
      return row
        ? documentTypeFromMongoDocument(row as DocumentTypeMongoRead)
        : err(documentTypeNotFoundFailure());
    } catch (error) {
      return err(mapMongoFailure(error));
    }
  }

  private async listActiveSafely(input: {
    filters: {name?: string; code?: string};
    afterId?: string;
    limit: number;
  }): Promise<Result<DocumentTypeListPage, DocumentTypeFailure>> {
    const model = this.model();
    if (!model) return err(unavailable());
    if (input.afterId && !Types.ObjectId.isValid(input.afterId)) {
      return err(
        documentTypeApplicationFailure("INVALID_QUERY_PARAMETER", "cursor position is invalid")
      );
    }

    try {
      const filter: Record<string, unknown> = {deletedAt: null};
      if (input.filters.name) {
        filter.nameNormalized = {
          $regex: escapeRegex(normalizeDocumentTypeName(input.filters.name))
        };
      }
      if (input.filters.code) filter.code = input.filters.code;
      if (input.afterId) filter._id = {$gt: new Types.ObjectId(input.afterId)};

      const rows = await model
        .find(filter)
        .sort({_id: 1})
        .limit(input.limit + 1)
        .lean();
      const mapped: DocumentType[] = [];
      for (const row of rows.slice(0, input.limit)) {
        const documentType = documentTypeFromMongoDocument(row as DocumentTypeMongoRead);
        if (documentType.isErr()) return err(documentType.error);
        mapped.push(documentType.value);
      }

      return ok({items: mapped, hasNext: rows.length > input.limit});
    } catch (error) {
      return err(mapMongoFailure(error));
    }
  }

  private async updateActiveSafely(
    documentType: DocumentType
  ): Promise<Result<DocumentType, DocumentTypeFailure>> {
    const model = this.model();
    const document = documentTypeToMongoDocument(documentType);
    if (!model) return err(unavailable());
    if (document.isErr()) return err(document.error);

    try {
      const row = await model
        .findOneAndUpdate(
          {_id: document.value._id, deletedAt: null},
          {
            $set: {
              name: document.value.name,
              nameNormalized: document.value.nameNormalized,
              code: document.value.code,
              description: document.value.description,
              updatedAt: document.value.updatedAt
            }
          },
          {returnDocument: "after", runValidators: true}
        )
        .lean();
      if (row) return documentTypeFromMongoDocument(row as DocumentTypeMongoRead);

      const existing = await model.findById(document.value._id).select({deletedAt: 1}).lean();
      if (existing?.deletedAt) {
        return err(
          documentTypeDomainFailure(
            "DOCUMENT_TYPE_DELETED",
            "Document type has already been deleted."
          )
        );
      }
      return err(documentTypeNotFoundFailure());
    } catch (error) {
      return err(mapMongoFailure(error));
    }
  }

  private async softDeleteActiveSafely(
    documentType: DocumentType,
    context: TransactionContext
  ): Promise<Result<boolean, DocumentTypeFailure>> {
    const model = this.model();
    const document = documentTypeToMongoDocument(documentType);
    const session = getMongoSession(context);
    if (!model || !session) return err(unavailable());
    if (document.isErr()) return err(document.error);

    try {
      const result = await model.updateOne(
        {_id: document.value._id, deletedAt: null},
        {$set: {deletedAt: document.value.deletedAt, updatedAt: document.value.updatedAt}},
        {session}
      );
      return ok(result.modifiedCount === 1);
    } catch (error) {
      return err(mapMongoFailure(error));
    }
  }

  private model() {
    const connection = this.connection();
    if (!connection) return undefined;
    try {
      return getDocumentTypeMongoModel(connection);
    } catch {
      return undefined;
    }
  }
}

function mapMongoFailure(error: unknown): DocumentTypeFailure {
  const key = (error as {keyPattern?: Record<string, number>}).keyPattern;
  if (key?.code) {
    return documentTypeApplicationFailure(
      "DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE",
      "An active document type already uses this code."
    );
  }

  const name = (error as {name?: string})?.name ?? "";
  if (/serverselection|network|timeout/i.test(name)) return unavailable();
  return documentTypeApplicationFailure(
    "INTERNAL_SERVER_ERROR",
    "Document type persistence failed."
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
