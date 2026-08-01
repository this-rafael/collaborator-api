import type {Result} from "neverthrow";

import type {TransactionContext} from "../../../../shared/application/ports/transaction-manager.js";
import type {CollaboratorDocumentsFailure} from "../../../collaborator-documents/application/contracts/soft-delete-collaborator-documents.input.js";

/** Entrada para exclusão em cascata de documentos vinculados a um tipo. */
export type SoftDeleteCollaboratorDocumentsByTypeInput = Readonly<{
  /** Identificador do tipo de documento cujos vínculos serão excluídos. */
  documentTypeId: string;
  /** Instante de exclusão (ISO 8601) aplicado aos vínculos em cascata. */
  deletedAt: string;
}>;

/**
 * Porta de saída para a exclusão em cascata de documentos de colaboradores
 * quando um tipo de documento é excluído.
 */
export interface CollaboratorDocumentsByTypePort {
  /**
   * Aplica o soft delete em cascata aos documentos vinculados ao tipo informado,
   * participando da mesma transação da exclusão do tipo.
   *
   * @param input - Identificador do tipo e instante de exclusão dos vínculos.
   * @param context - Contexto transacional compartilhado com a exclusão do tipo.
   * @returns Result com `void` em sucesso; em falha, `CollaboratorDocumentsFailure`.
   */
  execute(
    input: SoftDeleteCollaboratorDocumentsByTypeInput,
    context: TransactionContext
  ): Promise<Result<void, CollaboratorDocumentsFailure>>;
}
