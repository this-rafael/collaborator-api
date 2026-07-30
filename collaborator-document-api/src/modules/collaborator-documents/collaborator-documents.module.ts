import {Module} from "@tsed/di";

import {MongoObjectIdGenerator} from "../../shared/infrastructure/persistence/mongodb/mongo-object-id-generator.js";
import {SystemClock} from "../../shared/infrastructure/time/system-clock.js";
import {
  CollaboratorStatusReaderAdapter,
  DocumentTypeStatusReaderAdapter
} from "./infrastructure/adapters/parent-status.readers.js";
import {CollaboratorDocumentIndexProvisioner} from "./infrastructure/persistence/mongodb/collaborator-document.indexes.js";
import {MongoCollaboratorDocumentRepository} from "./infrastructure/persistence/mongodb/collaborator-document.mongo-repository.js";
import {CollaboratorDocumentsRuntime} from "./collaborator-documents.runtime.js";

/** Registro das dependências internas e da superfície pública do módulo. */
@Module({
  imports: [
    MongoCollaboratorDocumentRepository,
    CollaboratorDocumentsRuntime,
    CollaboratorStatusReaderAdapter,
    DocumentTypeStatusReaderAdapter,
    CollaboratorDocumentIndexProvisioner,
    MongoObjectIdGenerator,
    SystemClock
  ]
})
export class CollaboratorDocumentsModule {}
