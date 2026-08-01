import type {Result} from "neverthrow";

import type {TransactionContext} from "../../../../shared/application/ports/transaction-manager.js";
import type {
  CollaboratorDocumentsFailure,
  SoftDeleteCollaboratorDocumentsInput
} from "../../../collaborator-documents/application/contracts/soft-delete-collaborator-documents.input.js";

/**
 * API pública mínima do módulo collaborator-documents consumida por collaborators.
 *
 * @remarks
 * Porta que preserva o isolamento entre módulos: o módulo de colaboradores só
 * conhece esta interface, sem acoplar-se à implementação de documentos.
 */
export interface CollaboratorDocumentsPort {
  /**
   * Aplica o soft delete dos documentos vinculados a um colaborador.
   *
   * @param input - Identificador do colaborador e data da exclusão a propagar.
   * @param context - Contexto de transação compartilhado para manter a atomicidade.
   * @returns Result vazio (`void`) em sucesso; em falha, `CollaboratorDocumentsFailure`.
   */
  execute(
    input: SoftDeleteCollaboratorDocumentsInput,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>>;
}
