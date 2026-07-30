import {Module} from "@tsed/di";

import {MongoCollaboratorDocumentRepository} from "./infrastructure/persistence/mongodb/collaborator-document.mongo-repository.js";
import {CollaboratorDocumentsRuntime} from "./collaborator-documents.runtime.js";

/** Registro das dependências internas e da superfície pública do módulo. */
@Module({imports: [MongoCollaboratorDocumentRepository, CollaboratorDocumentsRuntime]})
export class CollaboratorDocumentsModule {}
