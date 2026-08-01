import type {Result} from "neverthrow";

import type {TransactionContext} from "../../../../shared/domain/transaction-context.js";
import type {DocumentType} from "../entities/document-type.js";
import type {DocumentTypeFailure} from "../errors/document-type.failure.js";

/** Filtros normalizados para listagem de tipos de documento. */
export type DocumentTypeListFilters = Readonly<{name?: string; code?: string}>;

/** Página de resultados de listagem de tipos de documento. */
export type DocumentTypeListPage = Readonly<{
  items: readonly DocumentType[];
  hasNext: boolean;
}>;

/**
 * Contrato de persistência (porta de saída) para o agregado de tipo de documento.
 *
 * @remarks
 * Todas as operações retornam `Result` (neverthrow) e não lançam erros de
 * negócio. As consultas e mutações operam apenas sobre tipos ativos (que não
 * sofreram soft delete), salvo indicação em contrário.
 */
export interface DocumentTypeRepository {
  /**
   * Persiste um novo tipo de documento.
   *
   * @param documentType - Agregado já validado a ser persistido.
   * @returns Result com o tipo persistido em sucesso; em falha,
   * `DocumentTypeFailure` (por exemplo, `DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE`
   * ao violar a unicidade do código entre ativos, ou `SERVICE_UNAVAILABLE`).
   */
  create(documentType: DocumentType): Promise<Result<DocumentType, DocumentTypeFailure>>;
  /**
   * Recupera um tipo de documento ativo pelo identificador.
   *
   * @param id - Identificador do tipo de documento.
   * @returns Result com o tipo encontrado em sucesso; em falha,
   * `DocumentTypeFailure` com código `DOCUMENT_TYPE_NOT_FOUND` quando inexistente.
   */
  findById(id: string): Promise<Result<DocumentType, DocumentTypeFailure>>;
  /**
   * Lista tipos de documento ativos aplicando filtros e paginação por cursor.
   *
   * @param input - Parâmetros da listagem (`filters` por nome/código,
   *   `afterId` cursor opcional, `limit` quantidade máxima).
   * @returns Result com uma página de resultados em sucesso; em falha,
   * `DocumentTypeFailure` (por exemplo, `SERVICE_UNAVAILABLE`).
   */
  listActive(input: {
    filters: DocumentTypeListFilters;
    afterId?: string;
    limit: number;
  }): Promise<Result<DocumentTypeListPage, DocumentTypeFailure>>;
  /**
   * Atualiza um tipo de documento ativo.
   *
   * @param documentType - Agregado já atualizado a ser persistido.
   * @returns Result com o tipo atualizado em sucesso; em falha,
   * `DocumentTypeFailure` (por exemplo, `DOCUMENT_TYPE_NOT_FOUND`,
   * `DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE` ou `SERVICE_UNAVAILABLE`).
   */
  updateActive(documentType: DocumentType): Promise<Result<DocumentType, DocumentTypeFailure>>;
  /**
   * Aplica soft delete a um tipo de documento ativo dentro de uma transação,
   * marcando em cascata os vínculos relacionados.
   *
   * @param documentType - Agregado a ser marcado como excluído.
   * @param context - Contexto transacional que envolve a exclusão e a cascata.
   * @returns Result com `true` quando a exclusão é efetivada em sucesso; em
   * falha, `DocumentTypeFailure` (por exemplo, `DOCUMENT_TYPE_NOT_FOUND` ou
   * `SERVICE_UNAVAILABLE`).
   */
  softDeleteActive(
    documentType: DocumentType,
    context: TransactionContext
  ): Promise<Result<boolean, DocumentTypeFailure>>;
}
