import {err, type Result} from "neverthrow";

import type {DocumentVersionOutput} from "../contracts/document-version-output.js";
import type {CollaboratorDocumentRepository} from "../ports/collaborator-document-repository.port.js";
import {
  collaboratorDocumentApplicationFailure,
  type CollaboratorDocumentFailure
} from "../../domain/errors/collaborator-document.failure.js";

/** Entrada normalizada para consultar uma versão específica. */
export type GetDocumentVersionInput = Readonly<{id: string; version: number}>;

/** Caso de uso de leitura de uma versão específica do histórico. */
export class GetDocumentVersionUseCase {
  constructor(private readonly repository: Pick<CollaboratorDocumentRepository, "getVersion">) {}

  async execute(
    input: GetDocumentVersionInput
  ): Promise<Result<DocumentVersionOutput, CollaboratorDocumentFailure>> {
    try {
      return await this.repository.getVersion(input);
    } catch {
      return err(
        collaboratorDocumentApplicationFailure(
          "INTERNAL_SERVER_ERROR",
          "Document version lookup failed."
        )
      );
    }
  }
}
