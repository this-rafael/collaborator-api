import {err, ok, type Result} from "neverthrow";

import type {Clock} from "../../../../shared/application/ports/clock.js";
import {
  collaboratorDocumentApplicationFailure,
  type CollaboratorDocumentFailure
} from "../../domain/errors/collaborator-document.failure.js";
import type {
  DocumentVersionMetadata,
  DocumentVersionOutput
} from "../contracts/document-version-output.js";
import type {CollaboratorDocumentRepository} from "../ports/collaborator-document-repository.port.js";

/** Entrada para anexar uma nova versão ao histórico de um vínculo. */
export type CreateDocumentVersionInput = Readonly<{
  id: string;
  metadata: DocumentVersionMetadata;
}>;

/** Caso de uso de envio e reenvio de versão documental. */
export class CreateDocumentVersionUseCase {
  constructor(
    private readonly repository: Pick<CollaboratorDocumentRepository, "appendVersion">,
    private readonly clock: Clock
  ) {}

  /** Anexa uma nova versão usando um único instante para submissão e atualização. */
  async execute(
    input: CreateDocumentVersionInput
  ): Promise<Result<DocumentVersionOutput, CollaboratorDocumentFailure>> {
    let submittedAt: Date;
    try {
      submittedAt = this.clock.now();
    } catch {
      return err(
        collaboratorDocumentApplicationFailure(
          "INTERNAL_SERVER_ERROR",
          "Document version submission dependencies failed."
        )
      );
    }

    try {
      const appended = await this.repository.appendVersion({
        id: input.id,
        metadata: input.metadata,
        submittedAt
      });
      if (appended.isErr()) return err(appended.error);
      return ok(appended.value);
    } catch {
      return err(
        collaboratorDocumentApplicationFailure(
          "INTERNAL_SERVER_ERROR",
          "Document version submission failed."
        )
      );
    }
  }
}
