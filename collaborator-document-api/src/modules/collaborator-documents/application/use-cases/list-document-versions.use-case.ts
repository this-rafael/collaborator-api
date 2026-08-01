import {err, type Result} from "neverthrow";

import type {DocumentVersionListPage} from "../contracts/document-version-output.js";
import type {CollaboratorDocumentRepository} from "../ports/collaborator-document-repository.port.js";
import {
  collaboratorDocumentApplicationFailure,
  type CollaboratorDocumentFailure
} from "../../domain/errors/collaborator-document.failure.js";

/** Entrada normalizada para listar o histórico de versões de um vínculo. */
export type ListDocumentVersionsInput = Readonly<{
  id: string;
  order: "asc" | "desc";
  limit: number;
  afterVersion?: number;
}>;

/** Caso de uso de leitura paginada do histórico de versões. */
export class ListDocumentVersionsUseCase {
  constructor(private readonly repository: Pick<CollaboratorDocumentRepository, "listVersions">) {}

  async execute(
    input: ListDocumentVersionsInput
  ): Promise<Result<DocumentVersionListPage, CollaboratorDocumentFailure>> {
    try {
      return await this.repository.listVersions(input);
    } catch {
      return err(
        collaboratorDocumentApplicationFailure(
          "INTERNAL_SERVER_ERROR",
          "Document version listing failed."
        )
      );
    }
  }
}
