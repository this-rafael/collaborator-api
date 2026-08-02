import {Injectable, InjectorService} from "@tsed/di";
import {err, ok, type Result} from "neverthrow";

import type {TransactionContext} from "../../../../shared/application/ports/transaction-manager.js";
import type {
  CollaboratorStatusReader,
  DocumentTypeStatusReader,
  ParentStatus
} from "../../application/ports/parent-status.readers.js";
import {
  collaboratorDocumentApplicationFailure,
  type CollaboratorDocumentFailure
} from "../../domain/errors/collaborator-document.failure.js";

/** Adapter que consulta o módulo público de colaboradores. */
@Injectable()
export class CollaboratorStatusReaderAdapter implements CollaboratorStatusReader {
  constructor(private readonly injector: InjectorService) {}

  async reserveActive(
    collaboratorId: string,
    context: TransactionContext
  ): Promise<Result<ParentStatus, CollaboratorDocumentFailure>> {
    try {
      const {CollaboratorsRuntime} =
        await import("../../../collaborators/collaborators.runtime.js");
      const runtime =
        this.injector.get<InstanceType<typeof CollaboratorsRuntime>>(CollaboratorsRuntime);
      const result = await runtime.reserveActiveForDocumentLink(collaboratorId, context);
      if (result.isErr()) {
        if (result.error.code === "COLLABORATOR_NOT_FOUND") {
          return err(
            collaboratorDocumentApplicationFailure(
              "COLLABORATOR_NOT_FOUND",
              "Collaborator was not found."
            )
          );
        }
        if (result.error.code === "COLLABORATOR_DELETED") {
          return err(
            collaboratorDocumentApplicationFailure(
              "COLLABORATOR_DELETED",
              "Collaborator was deleted."
            )
          );
        }
        if (result.error.code === "SERVICE_UNAVAILABLE") {
          return err(
            collaboratorDocumentApplicationFailure(
              "SERVICE_UNAVAILABLE",
              "Collaborator status is unavailable."
            )
          );
        }
        return err(
          collaboratorDocumentApplicationFailure(
            "INTERNAL_SERVER_ERROR",
            "Collaborator status lookup failed."
          )
        );
      }
      return ok("ACTIVE");
    } catch {
      return err(
        collaboratorDocumentApplicationFailure(
          "SERVICE_UNAVAILABLE",
          "Collaborator status is unavailable."
        )
      );
    }
  }
}

/** Adapter que consulta o módulo público de tipos de documento. */
@Injectable()
export class DocumentTypeStatusReaderAdapter implements DocumentTypeStatusReader {
  constructor(private readonly injector: InjectorService) {}

  async reserveActive(
    documentTypeId: string,
    context: TransactionContext
  ): Promise<Result<ParentStatus, CollaboratorDocumentFailure>> {
    try {
      const {DocumentTypesRuntime} =
        await import("../../../document-types/document-types.runtime.js");
      const runtime =
        this.injector.get<InstanceType<typeof DocumentTypesRuntime>>(DocumentTypesRuntime);
      const result = await runtime.reserveActiveForDocumentLink(documentTypeId, context);
      if (result.isErr()) {
        if (result.error.code === "DOCUMENT_TYPE_NOT_FOUND") {
          return err(
            collaboratorDocumentApplicationFailure(
              "DOCUMENT_TYPE_NOT_FOUND",
              "Document type was not found."
            )
          );
        }
        if (result.error.code === "DOCUMENT_TYPE_DELETED") {
          return err(
            collaboratorDocumentApplicationFailure(
              "DOCUMENT_TYPE_DELETED",
              "Document type was deleted."
            )
          );
        }
        if (result.error.code === "SERVICE_UNAVAILABLE") {
          return err(
            collaboratorDocumentApplicationFailure(
              "SERVICE_UNAVAILABLE",
              "Document type status is unavailable."
            )
          );
        }
        return err(
          collaboratorDocumentApplicationFailure(
            "INTERNAL_SERVER_ERROR",
            "Document type status lookup failed."
          )
        );
      }
      return ok("ACTIVE");
    } catch {
      return err(
        collaboratorDocumentApplicationFailure(
          "SERVICE_UNAVAILABLE",
          "Document type status is unavailable."
        )
      );
    }
  }
}
