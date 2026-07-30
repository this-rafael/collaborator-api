import {err, ok, type Result} from "neverthrow";

import type {CollaboratorDocumentFailure} from "../../domain/errors/collaborator-document.failure.js";
import type {CollaboratorDocumentOutput} from "../contracts/collaborator-document-output.js";
import type {CollaboratorDocumentRepository} from "../ports/collaborator-document-repository.port.js";

/** Caso de uso de consulta de vínculo documental por id. */
export class GetCollaboratorDocumentUseCase {
  constructor(private readonly repository: Pick<CollaboratorDocumentRepository, "findById">) {}

  async execute(input: {
    id: string;
  }): Promise<Result<CollaboratorDocumentOutput, CollaboratorDocumentFailure>> {
    const found = await this.repository.findById(input.id);
    if (found.isErr()) return err(found.error);
    return ok(found.value);
  }
}
