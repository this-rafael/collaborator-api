import {Module} from "@tsed/di";

import {SystemClock} from "../../shared/infrastructure/time/system-clock.js";
import {MongoReportingRepository} from "./infrastructure/persistence/mongodb/mongo-reporting.repository.js";
import {PendingDocumentsIndexProvisioner} from "./infrastructure/persistence/mongodb/pending-documents.indexes.js";
import {ReportingRuntime} from "./reporting.runtime.js";

/** Registro das dependências internas do módulo de consultas agregadas. */
@Module({
  imports: [
    ReportingRuntime,
    MongoReportingRepository,
    PendingDocumentsIndexProvisioner,
    SystemClock
  ]
})
export class ReportingModule {}
