import {err, ok, type Result} from "neverthrow";

import type {Clock} from "../../../../shared/application/ports/clock.js";
import {
  documentTypeApplicationFailure,
  type DocumentTypeFailure
} from "../../domain/errors/document-type.failure.js";
import type {UpdateDocumentTypeInput} from "../contracts/document-type-input.js";
import {documentTypeToOutput, type DocumentTypeOutput} from "../contracts/document-type-output.js";
import type {DocumentTypeRepository} from "../../domain/repositories/document-type.repository.js";

/** Caso de uso para atualização de um tipo de documento ativo. */
export class UpdateDocumentTypeUseCase {
  /**
   * @param repository - Repositório usado para localizar e atualizar o tipo.
   * @param clock - Relógio que fornece o instante corrente.
   */
  constructor(
    private readonly repository: Pick<DocumentTypeRepository, "findById" | "updateActive">,
    private readonly clock: Clock
  ) {}

  /**
   * Atualiza um tipo de documento ativo aplicando um patch parcial.
   *
   * @param input - Identificador do tipo e conjunto parcial de campos a alterar.
   * @returns Result com `DocumentTypeOutput` em sucesso; em falha,
   * `DocumentTypeFailure` com códigos `DOCUMENT_TYPE_NOT_FOUND`,
   * `DOCUMENT_TYPE_DELETED` (tipo já excluído), `VALIDATION_ERROR` (patch inválido),
   * `DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE`, `INTERNAL_SERVER_ERROR` (relógio
   * indisponível) ou `SERVICE_UNAVAILABLE`.
   */
  async execute(
    input: UpdateDocumentTypeInput
  ): Promise<Result<DocumentTypeOutput, DocumentTypeFailure>> {
    const found = await this.repository.findById(input.id);
    if (found.isErr()) return err(found.error);

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
    const updated = found.value.update(input.patch, now);
    if (updated.isErr()) return err(updated.error);

    const persisted = await this.repository.updateActive(updated.value);
    if (persisted.isErr()) return err(persisted.error);
    return ok(documentTypeToOutput(persisted.value));
  }
}
