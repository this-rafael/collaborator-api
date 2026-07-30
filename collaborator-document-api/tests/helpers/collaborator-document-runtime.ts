import {err, ok, type Result} from "neverthrow";

import {
  activeCollaboratorDocumentFixture,
  linkPendingFixture,
  type CollaboratorDocumentFixture
} from "./collaborator-document-fixtures.js";

export type CollaboratorDocumentRuntimeFailureCode =
  | "ACTIVE_LINK_ALREADY_EXISTS"
  | "COLLABORATOR_DELETED"
  | "COLLABORATOR_NOT_FOUND"
  | "DOCUMENT_TYPE_DELETED"
  | "DOCUMENT_TYPE_NOT_FOUND"
  | "INTERNAL_SERVER_ERROR"
  | "SERVICE_UNAVAILABLE";

export type CollaboratorDocumentRuntimeFailure = Readonly<{
  kind: "application";
  code: CollaboratorDocumentRuntimeFailureCode;
  message: string;
}>;

export type CollaboratorDocumentCreateInput = Readonly<{
  collaboratorId: string;
  documentTypeId: string;
}>;

export type ParentStatus = "ACTIVE";

export interface CollaboratorStatusReader {
  read(collaboratorId: string): Promise<Result<ParentStatus, CollaboratorDocumentRuntimeFailure>>;
}

export interface DocumentTypeStatusReader {
  read(documentTypeId: string): Promise<Result<ParentStatus, CollaboratorDocumentRuntimeFailure>>;
}

export interface CollaboratorDocumentRepository {
  create(
    input: CollaboratorDocumentCreateInput
  ): Promise<Result<CollaboratorDocumentFixture, CollaboratorDocumentRuntimeFailure>>;
}

const runtimeFailure = (
  code: CollaboratorDocumentRuntimeFailureCode,
  message?: string
): CollaboratorDocumentRuntimeFailure => ({kind: "application", code, message: message ?? code});

export class CollaboratorDocumentRepositoryStub implements CollaboratorDocumentRepository {
  constructor(
    private readonly result: Promise<
      Result<CollaboratorDocumentFixture, CollaboratorDocumentRuntimeFailure>
    > = Promise.resolve(ok(linkPendingFixture()))
  ) {}

  async create(
    _input: CollaboratorDocumentCreateInput
  ): Promise<Result<CollaboratorDocumentFixture, CollaboratorDocumentRuntimeFailure>> {
    return this.result;
  }

  static success(
    fixture: CollaboratorDocumentFixture = activeCollaboratorDocumentFixture()
  ): CollaboratorDocumentRepositoryStub {
    return new CollaboratorDocumentRepositoryStub(Promise.resolve(ok(fixture)));
  }

  static duplicate(): CollaboratorDocumentRepositoryStub {
    return new CollaboratorDocumentRepositoryStub(
      Promise.resolve(
        err(
          runtimeFailure(
            "ACTIVE_LINK_ALREADY_EXISTS",
            "An active collaborator-document link already exists."
          )
        )
      )
    );
  }

  static unavailable(): CollaboratorDocumentRepositoryStub {
    return new CollaboratorDocumentRepositoryStub(
      Promise.resolve(
        err(
          runtimeFailure("SERVICE_UNAVAILABLE", "Collaborator document persistence is unavailable.")
        )
      )
    );
  }
}

export class CollaboratorStatusReaderStub implements CollaboratorStatusReader {
  constructor(
    private readonly result: Promise<
      Result<ParentStatus, CollaboratorDocumentRuntimeFailure>
    > = Promise.resolve(ok("ACTIVE"))
  ) {}

  async read(
    _collaboratorId: string
  ): Promise<Result<ParentStatus, CollaboratorDocumentRuntimeFailure>> {
    return this.result;
  }

  static success(): CollaboratorStatusReaderStub {
    return new CollaboratorStatusReaderStub(Promise.resolve(ok("ACTIVE")));
  }

  static notFound(): CollaboratorStatusReaderStub {
    return new CollaboratorStatusReaderStub(
      Promise.resolve(err(runtimeFailure("COLLABORATOR_NOT_FOUND", "Collaborator was not found.")))
    );
  }

  static deleted(): CollaboratorStatusReaderStub {
    return new CollaboratorStatusReaderStub(
      Promise.resolve(err(runtimeFailure("COLLABORATOR_DELETED", "Collaborator was deleted.")))
    );
  }

  static unavailable(): CollaboratorStatusReaderStub {
    return new CollaboratorStatusReaderStub(
      Promise.resolve(
        err(runtimeFailure("SERVICE_UNAVAILABLE", "Collaborator status is unavailable."))
      )
    );
  }
}

export class DocumentTypeStatusReaderStub implements DocumentTypeStatusReader {
  constructor(
    private readonly result: Promise<
      Result<ParentStatus, CollaboratorDocumentRuntimeFailure>
    > = Promise.resolve(ok("ACTIVE"))
  ) {}

  async read(
    _documentTypeId: string
  ): Promise<Result<ParentStatus, CollaboratorDocumentRuntimeFailure>> {
    return this.result;
  }

  static success(): DocumentTypeStatusReaderStub {
    return new DocumentTypeStatusReaderStub(Promise.resolve(ok("ACTIVE")));
  }

  static notFound(): DocumentTypeStatusReaderStub {
    return new DocumentTypeStatusReaderStub(
      Promise.resolve(
        err(runtimeFailure("DOCUMENT_TYPE_NOT_FOUND", "Document type was not found."))
      )
    );
  }

  static deleted(): DocumentTypeStatusReaderStub {
    return new DocumentTypeStatusReaderStub(
      Promise.resolve(err(runtimeFailure("DOCUMENT_TYPE_DELETED", "Document type was deleted.")))
    );
  }

  static unavailable(): DocumentTypeStatusReaderStub {
    return new DocumentTypeStatusReaderStub(
      Promise.resolve(
        err(runtimeFailure("SERVICE_UNAVAILABLE", "Document type status is unavailable."))
      )
    );
  }
}
