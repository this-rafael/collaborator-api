import {err, ok, type Result} from "neverthrow";

import type {Clock} from "../../../../shared/application/ports/clock.js";
import type {IdGenerator} from "../../../../shared/application/ports/id-generator.js";
import {CollaboratorDocument} from "../../domain/aggregates/collaborator-document.js";
import {
  collaboratorDocumentApplicationFailure,
  type CollaboratorDocumentFailure
} from "../../domain/errors/collaborator-document.failure.js";
import type {CollaboratorDocumentOutput} from "../contracts/collaborator-document-output.js";
import type {CollaboratorDocumentRepository} from "../ports/collaborator-document-repository.port.js";
import type {
  CollaboratorStatusReader,
  DocumentTypeStatusReader
} from "../ports/parent-status.readers.js";

/** Entrada de criação de vínculo. */
export type CreateCollaboratorDocumentInput = Readonly<{
  collaboratorId: string;
  documentTypeId: string;
}>;

/** Caso de uso de criação / revinculação de vínculo documental. */
export class CreateCollaboratorDocumentUseCase {
  constructor(
    private readonly repository: Pick<CollaboratorDocumentRepository, "create">,
    private readonly collaborators: CollaboratorStatusReader,
    private readonly documentTypes: DocumentTypeStatusReader,
    private readonly clock: Clock,
    private readonly ids: IdGenerator
  ) {}

  async execute(
    input: CreateCollaboratorDocumentInput
  ): Promise<Result<CollaboratorDocumentOutput, CollaboratorDocumentFailure>> {
    const collaborator = await this.collaborators.read(input.collaboratorId);
    if (collaborator.isErr()) return err(collaborator.error);

    const documentType = await this.documentTypes.read(input.documentTypeId);
    if (documentType.isErr()) return err(documentType.error);

    let id: string;
    let now: Date;
    try {
      id = this.ids.next();
      now = this.clock.now();
    } catch {
      return err(
        collaboratorDocumentApplicationFailure(
          "INTERNAL_SERVER_ERROR",
          "Collaborator document creation dependencies failed."
        )
      );
    }

    const document = CollaboratorDocument.createPendingCycle(
      {id, collaboratorId: input.collaboratorId, documentTypeId: input.documentTypeId},
      now
    );
    if (document.isErr()) return err(document.error);

    const created = await this.repository.create(document.value);
    if (created.isErr()) return err(created.error);
    return ok(created.value);
  }
}
