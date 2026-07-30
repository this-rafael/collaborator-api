import {errAsync, okAsync, type ResultAsync} from "neverthrow";

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
  constructor(
    private readonly repository: Pick<CollaboratorRepository, "findById" | "softDeleteActive">,
    private readonly documents: CollaboratorDocumentsPort,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock
  ) {}

  execute(input: CollaboratorIdInput): ResultAsync<void, CollaboratorFailure | TransactionFailure> {
    return this.repository.findById(input.id).andThen((existing) => {
      if (existing.deletedAt !== null) return okAsync(undefined);

      let now: Date;
      try {
        now = this.clock.now();
      } catch {
        return errAsync(
          collaboratorApplicationFailure(
            "INTERNAL_SERVER_ERROR",
            "Collaborator clock is unavailable."
          )
        );
      }
      const deleted = existing.softDelete(now);
      if (deleted.isErr()) return errAsync(deleted.error);

      return this.transactions.execute((context) =>
        this.repository.softDeleteActive(deleted.value, context).andThen((wasDeleted) => {
          if (!wasDeleted) return okAsync(undefined);

          return this.documents
            .execute(
              {
                collaboratorId: deleted.value.id,
                deletedAt: deleted.value.deletedAt!.toISOString()
              },
              context
            )
            .mapErr((failure) => ({
              kind: "application" as const,
              code: failure.code,
              message: failure.message
            }));
        })
      );
    });
  }
}
