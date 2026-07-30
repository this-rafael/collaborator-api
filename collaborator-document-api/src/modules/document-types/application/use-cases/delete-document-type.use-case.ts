import {errAsync, okAsync, type ResultAsync} from "neverthrow";

import type {Clock} from "../../../../shared/application/ports/clock.js";
import type {
  TransactionFailure,
  TransactionManager
} from "../../../../shared/application/ports/transaction-manager.js";
import {
  documentTypeApplicationFailure,
  type DocumentTypeFailure
} from "../../domain/errors/document-type.failure.js";
import type {DocumentTypeRepository} from "../../domain/repositories/document-type.repository.js";
import type {DocumentTypeIdInput} from "../contracts/document-type-input.js";
import type {CollaboratorDocumentsByTypePort} from "../ports/collaborator-documents-by-type.port.js";

export class DeleteDocumentTypeUseCase {
  constructor(
    private readonly repository: Pick<DocumentTypeRepository, "findById" | "softDeleteActive">,
    private readonly documents: CollaboratorDocumentsByTypePort,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock
  ) {}

  execute(input: DocumentTypeIdInput): ResultAsync<void, DocumentTypeFailure | TransactionFailure> {
    return this.repository.findById(input.id).andThen((existing) => {
      if (existing.deletedAt !== null) return okAsync(undefined);

      let now: Date;
      try {
        now = this.clock.now();
      } catch {
        return errAsync(
          documentTypeApplicationFailure(
            "INTERNAL_SERVER_ERROR",
            "Document type clock is unavailable."
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
                documentTypeId: deleted.value.id,
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
