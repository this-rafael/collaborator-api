/**
 * Value object de status do vínculo documental (PENDING/SUBMITTED).
 */
import {err, ok, type Result} from "neverthrow";

import {
  collaboratorDocumentDomainFailure,
  type CollaboratorDocumentDomainFailure
} from "../errors/collaborator-document.failure.js";

/**
 * Status documental permitido pelo domínio.
 *
 * @remarks
 * `PENDING` indica vínculo sem envio (`currentVersion=0`); `SUBMITTED` indica
 * que ao menos uma versão foi enviada.
 */
export type DocumentStatusValue = "PENDING" | "SUBMITTED";

/**
 * Value object que encapsula e valida o status do vínculo documental.
 */
export class DocumentStatus {
  private constructor(readonly value: DocumentStatusValue) {}

  /**
   * Cria um {@link DocumentStatus} a partir de um valor arbitrário.
   *
   * @param value - Valor candidato ao status (espera-se "PENDING" ou "SUBMITTED").
   * @returns Result com o value object em sucesso; em falha,
   * CollaboratorDocumentDomainFailure com código VALIDATION_ERROR quando o valor
   * não é um status reconhecido.
   */
  static create(value: unknown): Result<DocumentStatus, CollaboratorDocumentDomainFailure> {
    if (value === "PENDING" || value === "SUBMITTED") return ok(new DocumentStatus(value));
    return err(
      collaboratorDocumentDomainFailure("VALIDATION_ERROR", "status must be PENDING or SUBMITTED")
    );
  }
}
