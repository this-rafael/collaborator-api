/**
 * Porta de persistência (hexagonal) do módulo collaborator-documents.
 *
 * @remarks
 * Define o contrato que a infraestrutura deve implementar, mantendo a aplicação
 * independente do MongoDB. Todas as operações retornam `Result` em vez de lançar.
 */
import type {Result} from "neverthrow";

import type {TransactionContext} from "../../../../shared/application/ports/transaction-manager.js";
import type {CollaboratorDocument} from "../../domain/aggregates/collaborator-document.js";
import type {CollaboratorDocumentFailure} from "../../domain/errors/collaborator-document.failure.js";
import type {CollaboratorDocumentsFailure} from "../contracts/soft-delete-collaborator-documents.input.js";
import type {CollaboratorDocumentOutput} from "../contracts/collaborator-document-output.js";
import type {
  DocumentVersionListPage,
  DocumentVersionMetadata,
  DocumentVersionOutput
} from "../contracts/document-version-output.js";

/**
 * Filtros normalizados aplicados à listagem de vínculos.
 *
 * @remarks
 * `lifecycle` controla a visibilidade por estado do ciclo de vida (ativo,
 * desvinculado, excluído ou todos).
 */
export type CollaboratorDocumentListFilters = Readonly<{
  collaboratorId?: string;
  documentTypeId?: string;
  status?: "PENDING" | "SUBMITTED";
  lifecycle: "active" | "unlinked" | "deleted" | "all";
}>;

/**
 * Página de resultados da listagem por keyset (cursor).
 *
 * @remarks
 * `hasNext` indica se há mais itens além dos retornados em `items`.
 */
export type CollaboratorDocumentListPage = Readonly<{
  items: readonly CollaboratorDocumentOutput[];
  hasNext: boolean;
}>;

/** Porta de persistência do módulo collaborator-documents. */
export interface CollaboratorDocumentRepository {
  /**
   * Anexa uma versão ao histórico do vínculo em uma atualização atômica.
   *
   * @param input - Identificador, metadados normalizados e instante da submissão.
   * @returns Result com a versão criada; em falha, um código de ciclo de vida,
   * capacidade ou disponibilidade.
   */
  appendVersion(input: {
    id: string;
    metadata: DocumentVersionMetadata;
    submittedAt: Date;
  }): Promise<Result<DocumentVersionOutput, CollaboratorDocumentFailure>>;
  /**
   * Lista o histórico embutido de versões por keyset numérico.
   *
   * @param input - Identificador do vínculo, ordenação, limite e âncora opcionais.
   * @returns Página de versões mesmo para vínculos históricos; 404 somente quando
   * o vínculo não existe.
   */
  listVersions(input: {
    id: string;
    order: "asc" | "desc";
    limit: number;
    afterVersion?: number;
  }): Promise<Result<DocumentVersionListPage, CollaboratorDocumentFailure>>;
  /**
   * Aplica soft delete em cascata aos vínculos ativos de um colaborador.
   *
   * @param collaboratorId - Identificador do colaborador excluído.
   * @param deletedAt - Instante da exclusão a gravar em `deletedAt`.
   * @param context - Contexto transacional que envolve a cascata.
   * @returns Result vazio em sucesso; em falha, CollaboratorDocumentsFailure com
   * código SERVICE_UNAVAILABLE ou INTERNAL_SERVER_ERROR.
   */
  softDeleteActiveByCollaboratorId(
    collaboratorId: string,
    deletedAt: Date,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>>;
  /**
   * Aplica soft delete em cascata aos vínculos ativos de um tipo de documento.
   *
   * @param documentTypeId - Identificador do tipo de documento excluído.
   * @param deletedAt - Instante da exclusão a gravar em `deletedAt`.
   * @param context - Contexto transacional que envolve a cascata.
   * @returns Result vazio em sucesso; em falha, CollaboratorDocumentsFailure com
   * código SERVICE_UNAVAILABLE ou INTERNAL_SERVER_ERROR.
   */
  softDeleteActiveByDocumentTypeId(
    documentTypeId: string,
    deletedAt: Date,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>>;
  /**
   * Persiste um novo vínculo documental.
   *
   * @param document - Agregado a ser persistido.
   * @returns Result com a saída do vínculo criado em sucesso; em falha,
   * CollaboratorDocumentFailure com códigos ACTIVE_LINK_ALREADY_EXISTS,
   * SERVICE_UNAVAILABLE ou INTERNAL_SERVER_ERROR.
   */
  create(
    document: CollaboratorDocument
  ): Promise<Result<CollaboratorDocumentOutput, CollaboratorDocumentFailure>>;
  /**
   * Busca um vínculo documental por id.
   *
   * @param id - Identificador (ObjectId) do vínculo.
   * @returns Result com a saída do vínculo em sucesso; em falha,
   * CollaboratorDocumentFailure com códigos COLLABORATOR_DOCUMENT_NOT_FOUND,
   * SERVICE_UNAVAILABLE ou INTERNAL_SERVER_ERROR.
   */
  findById(id: string): Promise<Result<CollaboratorDocumentOutput, CollaboratorDocumentFailure>>;
  /**
   * Lista vínculos por keyset aplicando os filtros informados.
   *
   * @param input - Filtros normalizados, cursor `afterId` opcional e `limit` da página.
   * @returns Result com a página em sucesso; em falha, CollaboratorDocumentFailure
   * com códigos INVALID_QUERY_PARAMETER, SERVICE_UNAVAILABLE ou INTERNAL_SERVER_ERROR.
   */
  list(input: {
    filters: CollaboratorDocumentListFilters;
    afterId?: string;
    limit: number;
  }): Promise<Result<CollaboratorDocumentListPage, CollaboratorDocumentFailure>>;
  /**
   * Desvincula um vínculo ativo, preenchendo `unlinkedAt` sem apagar histórico.
   *
   * @param id - Identificador (ObjectId) do vínculo ativo.
   * @param unlinkedAt - Instante da desvinculação.
   * @param updatedAt - Instante de atualização do registro.
   * @returns Result vazio em sucesso; em falha, CollaboratorDocumentFailure com
   * códigos COLLABORATOR_DOCUMENT_NOT_FOUND, COLLABORATOR_DOCUMENT_DELETED,
   * COLLABORATOR_DOCUMENT_UNLINKED, SERVICE_UNAVAILABLE ou INTERNAL_SERVER_ERROR.
   */
  unlinkActive(
    id: string,
    unlinkedAt: Date,
    updatedAt: Date
  ): Promise<Result<void, CollaboratorDocumentFailure>>;
}
