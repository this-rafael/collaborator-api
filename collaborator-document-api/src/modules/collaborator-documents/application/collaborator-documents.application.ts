/**
 * Composition root framework-neutral do módulo collaborator-documents.
 *
 * @remarks
 * Reúne as dependências abstratas (portas) e monta os casos de uso, sem acoplar
 * a nenhum framework de injeção.
 */
import type {Clock} from "../../../shared/application/ports/clock.js";
import type {IdGenerator} from "../../../shared/application/ports/id-generator.js";
import type {CollaboratorDocumentRepository} from "./ports/collaborator-document-repository.port.js";
import type {
  CollaboratorStatusReader,
  DocumentTypeStatusReader
} from "./ports/parent-status.readers.js";
import {CreateCollaboratorDocumentUseCase} from "./use-cases/create-collaborator-document.use-case.js";
import {CreateDocumentVersionUseCase} from "./use-cases/create-document-version.use-case.js";
import {GetCollaboratorDocumentUseCase} from "./use-cases/get-collaborator-document.use-case.js";
import {GetDocumentVersionUseCase} from "./use-cases/get-document-version.use-case.js";
import {ListCollaboratorDocumentsUseCase} from "./use-cases/list-collaborator-documents.use-case.js";
import {ListDocumentVersionsUseCase} from "./use-cases/list-document-versions.use-case.js";
import {SoftDeleteCollaboratorDocumentsUseCase} from "./use-cases/soft-delete-collaborator-documents.use-case.js";
import {UnlinkCollaboratorDocumentUseCase} from "./use-cases/unlink-collaborator-document.use-case.js";

/** Dependências abstratas (portas) do composition root do módulo. */
export type CollaboratorDocumentsApplicationDependencies = Readonly<{
  repository: CollaboratorDocumentRepository;
  collaborators: CollaboratorStatusReader;
  documentTypes: DocumentTypeStatusReader;
  clock: Clock;
  ids: IdGenerator;
}>;

/** Fachada framework-neutral do módulo. */
export type CollaboratorDocumentsApplication = Readonly<{
  create: CreateCollaboratorDocumentUseCase;
  createVersion: CreateDocumentVersionUseCase;
  get: GetCollaboratorDocumentUseCase;
  getVersion: GetDocumentVersionUseCase;
  list: ListCollaboratorDocumentsUseCase;
  listVersions: ListDocumentVersionsUseCase;
  unlink: UnlinkCollaboratorDocumentUseCase;
  softDelete: SoftDeleteCollaboratorDocumentsUseCase;
}>;

/** Compõe os casos de uso a partir das dependências injetadas. */
export const createCollaboratorDocumentsApplication = (
  dependencies: CollaboratorDocumentsApplicationDependencies
): CollaboratorDocumentsApplication =>
  Object.freeze({
    create: new CreateCollaboratorDocumentUseCase(
      dependencies.repository,
      dependencies.collaborators,
      dependencies.documentTypes,
      dependencies.clock,
      dependencies.ids
    ),
    createVersion: new CreateDocumentVersionUseCase(dependencies.repository, dependencies.clock),
    get: new GetCollaboratorDocumentUseCase(dependencies.repository),
    getVersion: new GetDocumentVersionUseCase(dependencies.repository),
    list: new ListCollaboratorDocumentsUseCase(dependencies.repository),
    listVersions: new ListDocumentVersionsUseCase(dependencies.repository),
    unlink: new UnlinkCollaboratorDocumentUseCase(dependencies.repository, dependencies.clock),
    softDelete: new SoftDeleteCollaboratorDocumentsUseCase(dependencies.repository)
  });
