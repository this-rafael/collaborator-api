import {err, ok, type Result} from "neverthrow";

import type {Clock} from "../../../../shared/application/ports/clock.js";
import {
  collaboratorDocumentApplicationFailure,
  type CollaboratorDocumentFailure
} from "../../domain/errors/collaborator-document.failure.js";
import type {CollaboratorDocumentRepository} from "../ports/collaborator-document-repository.port.js";

/** Caso de uso de desvinculação de vínculo ativo. */
export class UnlinkCollaboratorDocumentUseCase {
  constructor(
    private readonly repository: Pick<CollaboratorDocumentRepository, "unlinkActive">,
    private readonly clock: Clock
  ) {}

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
