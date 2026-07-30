import type {Clock} from "../../../shared/application/ports/clock.js";
import type {IdGenerator} from "../../../shared/application/ports/id-generator.js";
import type {TransactionManager} from "../../../shared/application/ports/transaction-manager.js";
import type {CollaboratorRepository} from "../domain/repositories/collaborator.repository.js";
import type {CollaboratorDocumentsPort} from "./ports/collaborator-documents.port.js";
import {CreateCollaboratorUseCase} from "./use-cases/create-collaborator.use-case.js";
import {DeleteCollaboratorUseCase} from "./use-cases/delete-collaborator.use-case.js";
import {GetCollaboratorUseCase} from "./use-cases/get-collaborator.use-case.js";
import {ListCollaboratorsUseCase} from "./use-cases/list-collaborators.use-case.js";
import {UpdateCollaboratorUseCase} from "./use-cases/update-collaborator.use-case.js";

/** Dependências abstratas necessárias para compor o módulo fora da apresentação. */
export type CollaboratorsApplicationDependencies = Readonly<{
  repository: CollaboratorRepository;
  documents: CollaboratorDocumentsPort;
  transactions: TransactionManager;
  clock: Clock;
  ids: IdGenerator;
}>;

/** Fachada framework-neutral pronta para ser injetada pelo composition root. */
export type CollaboratorsApplication = Readonly<{
  create: CreateCollaboratorUseCase;
  get: GetCollaboratorUseCase;
  list: ListCollaboratorsUseCase;
  update: UpdateCollaboratorUseCase;
  delete: DeleteCollaboratorUseCase;
}>;

export const createCollaboratorsApplication = (
  dependencies: CollaboratorsApplicationDependencies
): CollaboratorsApplication =>
  Object.freeze({
    create: new CreateCollaboratorUseCase(
      dependencies.repository,
      dependencies.clock,
      dependencies.ids
    ),
    get: new GetCollaboratorUseCase(dependencies.repository),
    list: new ListCollaboratorsUseCase(dependencies.repository),
    update: new UpdateCollaboratorUseCase(dependencies.repository, dependencies.clock),
    delete: new DeleteCollaboratorUseCase(
      dependencies.repository,
      dependencies.documents,
      dependencies.transactions,
      dependencies.clock
    )
  });
