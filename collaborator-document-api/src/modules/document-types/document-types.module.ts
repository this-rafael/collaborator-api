import {Module} from "@tsed/di";

import {CollaboratorDocumentsModule} from "../collaborator-documents/collaborator-documents.module.js";
import {MongoTransactionManager} from "../../shared/infrastructure/persistence/mongodb/mongo-transaction-manager.js";
import {MongoObjectIdGenerator} from "../../shared/infrastructure/persistence/mongodb/mongo-object-id-generator.js";
import {SystemClock} from "../../shared/infrastructure/time/system-clock.js";
import {DocumentTypeIndexProvisioner} from "./infrastructure/persistence/mongodb/document-type.indexes.js";
import {MongoDocumentTypeRepository} from "./infrastructure/persistence/mongodb/document-type.mongo-repository.js";
import {DocumentTypesRuntime} from "./document-types.runtime.js";

/** Módulo Ts.ED que registra as dependências do domínio document-types. */
@Module({
  imports: [
    DocumentTypesRuntime,
    MongoDocumentTypeRepository,
    CollaboratorDocumentsModule,
    MongoTransactionManager,
    MongoObjectIdGenerator,
    SystemClock,
    DocumentTypeIndexProvisioner
  ]
})
export class DocumentTypesModule {}
