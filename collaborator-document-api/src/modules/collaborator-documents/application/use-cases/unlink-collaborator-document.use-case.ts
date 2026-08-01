/**
 * Caso de uso de desvinculação de um vínculo documental ativo.
 */
import {err, ok, type Result} from "neverthrow";

import type {Clock} from "../../../../shared/application/ports/clock.js";
import {
  collaboratorDocumentApplicationFailure,
  type CollaboratorDocumentFailure
} from "../../domain/errors/collaborator-document.failure.js";
import type {CollaboratorDocumentRepository} from "../ports/collaborator-document-repository.port.js";

/**
 * Caso de uso de desvinculação de vínculo ativo.
 *
 * @remarks
 * A desvinculação apenas preenche `unlinkedAt`, preservando o histórico do
 * vínculo. Não remove versões nem o documento.
 */
export class UnlinkCollaboratorDocumentUseCase {
  /**
   * @param repository - Porta de persistência (apenas a operação `unlinkActive`).
   * @param clock - Relógio para obter o instante de desvinculação.
   */
  constructor(
    private readonly repository: Pick<CollaboratorDocumentRepository, "unlinkActive">,
    private readonly clock: Clock
  ) {}

  /**
   * Desvincula o vínculo ativo identificado por `id`.
   *
   * @param input - Objeto contendo o `id` (ObjectId) do vínculo.
   * @returns Result vazio em sucesso; em falha, CollaboratorDocumentFailure com
   * códigos COLLABORATOR_DOCUMENT_NOT_FOUND, COLLABORATOR_DOCUMENT_DELETED,
   * COLLABORATOR_DOCUMENT_UNLINKED, SERVICE_UNAVAILABLE ou INTERNAL_SERVER_ERROR.
   */
  async execute(input: {id: string}): Promise<Result<void, CollaboratorDocumentFailure>> {
    let now: Date;
    try {
      now = this.clock.now();
    } catch {
      return err(
        collaboratorDocumentApplicationFailure(
          "INTERNAL_SERVER_ERROR",
          "Collaborator document unlink dependencies failed."
        )
      );
    }

    const unlinked = await this.repository.unlinkActive(input.id, now, now);
    if (unlinked.isErr()) return err(unlinked.error);
    return ok(undefined);
  }
}
