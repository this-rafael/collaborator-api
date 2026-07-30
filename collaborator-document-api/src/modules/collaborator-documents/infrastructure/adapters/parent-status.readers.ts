import {Injectable, InjectorService} from "@tsed/di";
import {err, ok, type Result} from "neverthrow";

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

  async read(collaboratorId: string): Promise<Result<ParentStatus, CollaboratorDocumentFailure>> {
    try {
      const {CollaboratorsRuntime} =
        await import("../../../collaborators/collaborators.runtime.js");
      const runtime =
        this.injector.get<InstanceType<typeof CollaboratorsRuntime>>(CollaboratorsRuntime);
      const result = await runtime.application.get.execute({id: collaboratorId});
      if (result.isErr()) {
        if (result.error.code === "COLLABORATOR_NOT_FOUND") {
          return err(
            collaboratorDocumentApplicationFailure(
              "COLLABORATOR_NOT_FOUND",
              "Collaborator was not found."
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
      if (result.value.deletedAt !== null) {
        return err(
          collaboratorDocumentApplicationFailure(
            "COLLABORATOR_DELETED",
            "Collaborator was deleted."
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

  async read(documentTypeId: string): Promise<Result<ParentStatus, CollaboratorDocumentFailure>> {
    try {
      const {DocumentTypesRuntime} =
        await import("../../../document-types/document-types.runtime.js");
      const runtime =
        this.injector.get<InstanceType<typeof DocumentTypesRuntime>>(DocumentTypesRuntime);
      const result = await runtime.application.get.execute({id: documentTypeId});
      if (result.isErr()) {
        if (result.error.code === "DOCUMENT_TYPE_NOT_FOUND") {
          return err(
            collaboratorDocumentApplicationFailure(
              "DOCUMENT_TYPE_NOT_FOUND",
              "Document type was not found."
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
      if (result.value.deletedAt !== null) {
        return err(
          collaboratorDocumentApplicationFailure(
            "DOCUMENT_TYPE_DELETED",
            "Document type was deleted."
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
