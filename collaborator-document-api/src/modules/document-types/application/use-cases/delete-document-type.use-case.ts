import {err, ok, type Result} from "neverthrow";

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

/** Caso de uso para exclusão lógica de um tipo de documento e seus vínculos. */
export class DeleteDocumentTypeUseCase {
  /**
   * @param repository - Repositório usado para localizar e excluir o tipo.
   * @param documents - Porta que aplica a exclusão em cascata dos vínculos.
   * @param transactions - Gerenciador transacional que envolve exclusão e cascata.
   * @param clock - Relógio que fornece o instante corrente.
   */
  constructor(
    private readonly repository: Pick<DocumentTypeRepository, "findById" | "softDeleteActive">,
    private readonly documents: CollaboratorDocumentsByTypePort,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock
  ) {}

  /**
   * Aplica soft delete a um tipo de documento e, em cascata, aos vínculos
   * relacionados, tudo dentro de uma única transação.
   *
   * @param input - Identificador do tipo de documento a excluir.
   * @returns Result com `void` em sucesso (idempotente: retorna sucesso se o tipo
   * já estiver excluído). Em falha, `DocumentTypeFailure` com códigos
   * `DOCUMENT_TYPE_NOT_FOUND`, `INTERNAL_SERVER_ERROR` (relógio indisponível) ou
   * `SERVICE_UNAVAILABLE`, ou ainda `TransactionFailure` da transação.
   * @remarks
   * A exclusão em cascata dos documentos vinculados participa da mesma transação
   * da exclusão do tipo, garantindo atomicidade.
   */
  async execute(
    input: DocumentTypeIdInput
  ): Promise<Result<void, DocumentTypeFailure | TransactionFailure>> {
    const found = await this.repository.findById(input.id);
    if (found.isErr()) return err(found.error);
    if (found.value.deletedAt !== null) return ok(undefined);

    let now: Date;
    try {
      now = this.clock.now();
    } catch {
      return err(
        documentTypeApplicationFailure(
          "INTERNAL_SERVER_ERROR",
          "Document type clock is unavailable."
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
          documentTypeId: deleted.value.id,
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
