/**
 * Portas de leitura do status das entidades-pai (colaborador e tipo de documento).
 *
 * @remarks
 * Permitem validar a elegibilidade para criação de vínculo sem acoplar o módulo
 * à infraestrutura dos módulos donos dessas entidades.
 */
import type {Result} from "neverthrow";

import type {TransactionContext} from "../../../../shared/application/ports/transaction-manager.js";
import type {CollaboratorDocumentFailure} from "../../domain/errors/collaborator-document.failure.js";

/**
 * Status da entidade-pai apto a receber um novo vínculo.
 *
 * @remarks
 * Somente entidades ativas ("ACTIVE") podem originar um vínculo; excluídas ou
 * inexistentes resultam em falha.
 */
export type ParentStatus = "ACTIVE";

/** Reserva um colaborador ativo na transação que criará o vínculo. */
export interface CollaboratorStatusReader {
  /**
   * Confirma que o colaborador está ativo e registra uma cerca de escrita.
   *
   * @param collaboratorId - Identificador do colaborador.
   * @returns Result com "ACTIVE" em sucesso; em falha, CollaboratorDocumentFailure
   * com códigos COLLABORATOR_NOT_FOUND, COLLABORATOR_DELETED, SERVICE_UNAVAILABLE
   * ou INTERNAL_SERVER_ERROR.
   */
  reserveActive(
    collaboratorId: string,
    context: TransactionContext
  ): Promise<Result<ParentStatus, CollaboratorDocumentFailure>>;
}

/** Reserva um tipo de documento ativo na transação que criará o vínculo. */
export interface DocumentTypeStatusReader {
  /**
   * Confirma que o tipo está ativo e registra uma cerca de escrita.
   *
   * @param documentTypeId - Identificador do tipo de documento.
   * @returns Result com "ACTIVE" em sucesso; em falha, CollaboratorDocumentFailure
   * com códigos DOCUMENT_TYPE_NOT_FOUND, DOCUMENT_TYPE_DELETED, SERVICE_UNAVAILABLE
   * ou INTERNAL_SERVER_ERROR.
   */
  reserveActive(
    documentTypeId: string,
    context: TransactionContext
  ): Promise<Result<ParentStatus, CollaboratorDocumentFailure>>;
}
