/**
 * Caso de uso de consulta de vínculo documental por id.
 */
import {err, ok, type Result} from "neverthrow";

import type {CollaboratorDocumentFailure} from "../../domain/errors/collaborator-document.failure.js";
import type {CollaboratorDocumentOutput} from "../contracts/collaborator-document-output.js";
import type {CollaboratorDocumentRepository} from "../ports/collaborator-document-repository.port.js";

/** Caso de uso de consulta de vínculo documental por id. */
export class GetCollaboratorDocumentUseCase {
  /**
   * @param repository - Porta de persistência (apenas a operação `findById`).
   */
  constructor(private readonly repository: Pick<CollaboratorDocumentRepository, "findById">) {}

  /**
   * Recupera um vínculo documental pelo seu identificador.
   *
   * @param input - Objeto contendo o `id` (ObjectId) do vínculo.
   * @returns Result com a saída do vínculo em sucesso; em falha,
   * CollaboratorDocumentFailure com códigos COLLABORATOR_DOCUMENT_NOT_FOUND,
   * SERVICE_UNAVAILABLE ou INTERNAL_SERVER_ERROR.
   */
  async execute(input: {
    id: string;
  }): Promise<Result<CollaboratorDocumentOutput, CollaboratorDocumentFailure>> {
    const found = await this.repository.findById(input.id);
    if (found.isErr()) return err(found.error);
    return ok(found.value);
  }
}
