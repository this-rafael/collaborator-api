/**
 * Portas de leitura do status das entidades-pai (colaborador e tipo de documento).
 *
 * @remarks
 * Permitem validar a elegibilidade para criação de vínculo sem acoplar o módulo
 * à infraestrutura dos módulos donos dessas entidades.
 */
import type {Result} from "neverthrow";

import type {CollaboratorDocumentFailure} from "../../domain/errors/collaborator-document.failure.js";

/**
 * Status da entidade-pai apto a receber um novo vínculo.
 *
 * @remarks
 * Somente entidades ativas ("ACTIVE") podem originar um vínculo; excluídas ou
 * inexistentes resultam em falha.
 */
export type ParentStatus = "ACTIVE";

/** Lê o status público de um colaborador sem acoplar à infra alheia. */
export interface CollaboratorStatusReader {
  /**
   * Consulta o status atual do colaborador.
   *
   * @param collaboratorId - Identificador do colaborador.
   * @returns Result com "ACTIVE" em sucesso; em falha, CollaboratorDocumentFailure
   * com códigos COLLABORATOR_NOT_FOUND, COLLABORATOR_DELETED, SERVICE_UNAVAILABLE
   * ou INTERNAL_SERVER_ERROR.
   */
  read(collaboratorId: string): Promise<Result<ParentStatus, CollaboratorDocumentFailure>>;
}

/** Lê o status público de um tipo de documento sem acoplar à infra alheia. */
export interface DocumentTypeStatusReader {
  /**
   * Consulta o status atual do tipo de documento.
   *
   * @param documentTypeId - Identificador do tipo de documento.
   * @returns Result com "ACTIVE" em sucesso; em falha, CollaboratorDocumentFailure
   * com códigos DOCUMENT_TYPE_NOT_FOUND, DOCUMENT_TYPE_DELETED, SERVICE_UNAVAILABLE
   * ou INTERNAL_SERVER_ERROR.
   */
  read(documentTypeId: string): Promise<Result<ParentStatus, CollaboratorDocumentFailure>>;
}
