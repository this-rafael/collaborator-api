/**
 * Caso de uso da cascata de soft delete de vínculos por colaborador.
 */
import {err, type Result} from "neverthrow";

import type {TransactionContext} from "../../../../shared/application/ports/transaction-manager.js";
import {
  collaboratorDocumentsFailure,
  type CollaboratorDocumentsFailure,
  type SoftDeleteCollaboratorDocumentsInput
} from "../contracts/soft-delete-collaborator-documents.input.js";
import type {CollaboratorDocumentRepository} from "../ports/collaborator-document-repository.port.js";

/**
 * API pública mínima do módulo collaborator-documents para a cascata de
 * exclusão. O módulo dono da coleção mantém a sua própria persistência.
 *
 * @remarks
 * Executada dentro da transação iniciada pelo módulo que exclui o colaborador,
 * garantindo atomicidade entre a exclusão do pai e a de seus vínculos.
 */
export class SoftDeleteCollaboratorDocumentsUseCase {
  /**
   * @param repository - Porta de persistência (apenas `softDeleteActiveByCollaboratorId`).
   */
  constructor(
    private readonly repository: Pick<
      CollaboratorDocumentRepository,
      "softDeleteActiveByCollaboratorId"
    >
  ) {}

  /**
   * Propaga o soft delete aos vínculos ativos do colaborador informado.
   *
   * @param input - Identificador do colaborador e instante de exclusão (ISO 8601).
   * @param context - Contexto transacional compartilhado com a exclusão do pai.
   * @returns Result vazio em sucesso; em falha, CollaboratorDocumentsFailure com
   * código INTERNAL_SERVER_ERROR (entrada inválida) ou SERVICE_UNAVAILABLE.
   */
  async execute(
    input: SoftDeleteCollaboratorDocumentsInput,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>> {
    if (!input || typeof input.collaboratorId !== "string" || typeof input.deletedAt !== "string") {
      return err(
        collaboratorDocumentsFailure(
          "INTERNAL_SERVER_ERROR",
          "Invalid collaborator document cascade input."
        )
      );
    }
    const deletedAt = new Date(input.deletedAt);
    if (!input.collaboratorId || Number.isNaN(deletedAt.getTime())) {
      return err(
        collaboratorDocumentsFailure(
          "INTERNAL_SERVER_ERROR",
          "Invalid collaborator document cascade input."
        )
      );
    }

    return this.repository.softDeleteActiveByCollaboratorId(
      input.collaboratorId,
      deletedAt,
      context
    );
  }
}
