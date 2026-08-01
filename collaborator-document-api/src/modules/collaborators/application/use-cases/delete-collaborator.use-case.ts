import {err, ok, type Result} from "neverthrow";

import type {Clock} from "../../../../shared/application/ports/clock.js";
import type {
  TransactionFailure,
  TransactionManager
} from "../../../../shared/application/ports/transaction-manager.js";
import {
  collaboratorApplicationFailure,
  type CollaboratorFailure
} from "../../domain/errors/collaborator.failure.js";
import type {CollaboratorRepository} from "../../domain/repositories/collaborator.repository.js";
import type {CollaboratorIdInput} from "../contracts/collaborator-input.js";
import type {CollaboratorDocumentsPort} from "../ports/collaborator-documents.port.js";

/** Exclui colaborador e seus vínculos por meio de portas públicas e transação opaca. */
export class DeleteCollaboratorUseCase {
  /**
   * @param repository - Porta de persistência restrita à busca e ao soft delete.
   * @param documents - Porta que propaga o soft delete aos documentos vinculados.
   * @param transactions - Gerenciador de transações que garante atomicidade da cascata.
   * @param clock - Relógio injetado usado para carimbar a data de exclusão.
   */
  constructor(
    private readonly repository: Pick<CollaboratorRepository, "findById" | "softDeleteActive">,
    private readonly documents: CollaboratorDocumentsPort,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock
  ) {}

  /**
   * Executa a exclusão lógica do colaborador e a cascata sobre seus vínculos.
   *
   * @param input - Identificador do colaborador a excluir.
   * @returns Result vazio (`void`) em sucesso, inclusive quando o colaborador já
   * estava excluído (operação idempotente); em falha, `CollaboratorFailure` com
   * códigos como `COLLABORATOR_NOT_FOUND`, `INTERNAL_SERVER_ERROR` ou
   * `SERVICE_UNAVAILABLE`, ou uma `TransactionFailure`.
   * @remarks
   * O soft delete do colaborador e a exclusão dos documentos relacionados
   * ocorrem na mesma transação MongoDB, preservando a consistência.
   */
  async execute(
    input: CollaboratorIdInput
  ): Promise<Result<void, CollaboratorFailure | TransactionFailure>> {
    const found = await this.repository.findById(input.id);
    if (found.isErr()) return err(found.error);
    if (found.value.deletedAt !== null) return ok(undefined);

    let now: Date;
    try {
      now = this.clock.now();
    } catch {
      return err(
        collaboratorApplicationFailure(
          "INTERNAL_SERVER_ERROR",
          "Collaborator clock is unavailable."
        )
      );
    }
    const deleted = found.value.softDelete(now);
    if (deleted.isErr()) return err(deleted.error);

    return this.transactions.execute(async (context) => {
      const persisted = await this.repository.softDeleteActive(deleted.value, context);
      if (persisted.isErr()) return err(persisted.error);
      if (!persisted.value) return ok(undefined);

      const documents = await this.documents.execute(
        {
          collaboratorId: deleted.value.id,
          deletedAt: deleted.value.deletedAt!.toISOString()
        },
        context
      );
      if (documents.isErr()) {
        return err({
          kind: "application" as const,
          code: documents.error.code,
          message: documents.error.message
        });
      }
      return ok(undefined);
    });
  }
}
