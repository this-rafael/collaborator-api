import {Module} from "@tsed/di";

import {CollaboratorDocumentsModule} from "../collaborator-documents/collaborator-documents.module.js";
import {MongoTransactionManager} from "../../shared/infrastructure/persistence/mongodb/mongo-transaction-manager.js";
import {MongoObjectIdGenerator} from "../../shared/infrastructure/persistence/mongodb/mongo-object-id-generator.js";
import {SystemClock} from "../../shared/infrastructure/time/system-clock.js";
import {CollaboratorIndexProvisioner} from "./infrastructure/persistence/mongodb/collaborator.indexes.js";
import {MongoCollaboratorRepository} from "./infrastructure/persistence/mongodb/collaborator.mongo-repository.js";
import {CollaboratorsRuntime} from "./collaborators.runtime.js";

/** Registro Ts.ED das dependências e da superfície HTTP do módulo. */
@Module({
  imports: [
    CollaboratorsRuntime,
    MongoCollaboratorRepository,
    CollaboratorDocumentsModule,
    MongoTransactionManager,
    MongoObjectIdGenerator,
    SystemClock,
    CollaboratorIndexProvisioner
  ]
})
export class CollaboratorsModule {}
