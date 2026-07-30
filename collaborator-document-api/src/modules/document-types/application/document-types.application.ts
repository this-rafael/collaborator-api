import type {Clock} from "../../../shared/application/ports/clock.js";
import type {IdGenerator} from "../../../shared/application/ports/id-generator.js";
import type {TransactionManager} from "../../../shared/application/ports/transaction-manager.js";
import type {DocumentTypeRepository} from "../domain/repositories/document-type.repository.js";
import type {CollaboratorDocumentsByTypePort} from "./ports/collaborator-documents-by-type.port.js";
import {CreateDocumentTypeUseCase} from "./use-cases/create-document-type.use-case.js";
import {DeleteDocumentTypeUseCase} from "./use-cases/delete-document-type.use-case.js";
import {GetDocumentTypeUseCase} from "./use-cases/get-document-type.use-case.js";
import {ListDocumentTypesUseCase} from "./use-cases/list-document-types.use-case.js";
import {UpdateDocumentTypeUseCase} from "./use-cases/update-document-type.use-case.js";

/** Dependências abstratas necessárias para compor o módulo fora da apresentação. */
export type DocumentTypesApplicationDependencies = Readonly<{
  repository: DocumentTypeRepository;
  documents: CollaboratorDocumentsByTypePort;
  transactions: TransactionManager;
  clock: Clock;
  ids: IdGenerator;
}>;

/** Fachada framework-neutral pronta para ser injetada pelo composition root. */
export type DocumentTypesApplication = Readonly<{
  create: CreateDocumentTypeUseCase;
  get: GetDocumentTypeUseCase;
  list: ListDocumentTypesUseCase;
  update: UpdateDocumentTypeUseCase;
  delete: DeleteDocumentTypeUseCase;
}>;

/** Compõe os casos de uso a partir das dependências injetadas. */
export const createDocumentTypesApplication = (
  dependencies: DocumentTypesApplicationDependencies
): DocumentTypesApplication =>
  Object.freeze({
    create: new CreateDocumentTypeUseCase(
      dependencies.repository,
      dependencies.clock,
      dependencies.ids
    ),
    get: new GetDocumentTypeUseCase(dependencies.repository),
    list: new ListDocumentTypesUseCase(dependencies.repository),
    update: new UpdateDocumentTypeUseCase(dependencies.repository, dependencies.clock),
    delete: new DeleteDocumentTypeUseCase(
      dependencies.repository,
      dependencies.documents,
      dependencies.transactions,
      dependencies.clock
    )
  });
