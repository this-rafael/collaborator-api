import cors from "cors";
import helmet from "helmet";

import {Configuration, Constant} from "@tsed/di";
import "@tsed/mongoose";
import "@tsed/platform-express";
import "@tsed/swagger";

import {HealthController} from "./controllers/health.controller.js";
import {ApiRootController} from "./controllers/api-root.controller.js";
import {CollaboratorsModule} from "./modules/collaborators/collaborators.module.js";
import {CollaboratorIndexProvisioner} from "./modules/collaborators/infrastructure/persistence/mongodb/collaborator.indexes.js";
import {CollaboratorsController} from "./modules/collaborators/presentation/http/controllers/collaborators.controller.js";
import {CollaboratorDocumentsModule} from "./modules/collaborator-documents/collaborator-documents.module.js";
import {CollaboratorDocumentIndexProvisioner} from "./modules/collaborator-documents/infrastructure/persistence/mongodb/collaborator-document.indexes.js";
import {CollaboratorDocumentsController} from "./modules/collaborator-documents/presentation/http/controllers/collaborator-documents.controller.js";
import {DocumentTypesModule} from "./modules/document-types/document-types.module.js";
import {DocumentTypeIndexProvisioner} from "./modules/document-types/infrastructure/persistence/mongodb/document-type.indexes.js";
import {DocumentTypesController} from "./modules/document-types/presentation/http/controllers/document-types.controller.js";
import {ReportingModule} from "./modules/reporting/reporting.module.js";
import {PendingDocumentsIndexProvisioner} from "./modules/reporting/infrastructure/persistence/mongodb/pending-documents.indexes.js";
import {CompletenessStatisticsController} from "./modules/reporting/presentation/http/controllers/completeness-statistics.controller.js";
import {LatestSubmissionsController} from "./modules/reporting/presentation/http/controllers/latest-submissions.controller.js";
import {PendingDocumentTypeStatisticsController} from "./modules/reporting/presentation/http/controllers/pending-document-type-statistics.controller.js";
import {PendingDocumentsController} from "./modules/reporting/presentation/http/controllers/pending-documents.controller.js";
import {MongoReadinessCheck} from "./shared/infrastructure/availability/mongo-readiness-check.js";
import {globalErrorMiddleware} from "./shared/presentation/http/filters/global-error.filter.js";
import {requestIdMiddleware} from "./shared/presentation/http/middlewares/request-id.middleware.js";
import {requestObservabilityMiddleware} from "./shared/presentation/http/middlewares/request-observability.middleware.js";
import {openApiSettings} from "./config/openapi.js";

const corsAllowlist = new Set(
  (process.env.CORS_ALLOWLIST ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || corsAllowlist.has(origin)) {
      callback(null, origin ?? false);
      return;
    }
    callback(null, false);
  }
});

/**
 * Classe raiz da aplicação Ts.ED.
 *
 * Declara a configuração global: portas HTTP/HTTPS, Swagger,
 * middlewares (CORS, helmet, request-id, observabilidade,
 * error-handler), controladores REST e importações
 * (CollaboratorsModule e MongoReadinessCheck).
 *
 * @remarks A instância é gerada automaticamente pelo
 *   container IoC do Ts.ED durante o bootstrap.
 */
@Configuration({
  httpsPort: false,
  settings: {"trust proxy": false},
  swagger: [openApiSettings],
  acceptMimes: ["application/json", "application/hal+json", "application/problem+json"],
  mount: {
    "/": [
      HealthController,
      ApiRootController,
      CollaboratorsController,
      DocumentTypesController,
      CollaboratorDocumentsController,
      LatestSubmissionsController,
      PendingDocumentsController,
      PendingDocumentTypeStatisticsController,
      CompletenessStatisticsController
    ]
  },
  imports: [
    CollaboratorsModule,
    DocumentTypesModule,
    CollaboratorDocumentsModule,
    ReportingModule,
    MongoReadinessCheck
  ],
  middlewares: [
    helmet(),
    corsMiddleware,
    requestIdMiddleware,
    requestObservabilityMiddleware,
    "json-parser",
    "urlencoded-parser",
    globalErrorMiddleware
  ],
  exclude: ["**/*.spec.ts"]
})
export class Server {
  @Constant<boolean>("collaborators.provisionIndexes", true)
  private readonly provisionCollaboratorIndexes!: boolean;

  @Constant<boolean>("documentTypes.provisionIndexes", true)
  private readonly provisionDocumentTypeIndexes!: boolean;

  @Constant<boolean>("collaboratorDocuments.provisionIndexes", true)
  private readonly provisionCollaboratorDocumentIndexes!: boolean;

  @Constant<boolean>("reporting.provisionIndexes", false)
  private readonly provisionReportingIndexes!: boolean;

  constructor(
    private readonly collaboratorIndexes: CollaboratorIndexProvisioner,
    private readonly documentTypeIndexes: DocumentTypeIndexProvisioner,
    private readonly collaboratorDocumentIndexes: CollaboratorDocumentIndexProvisioner,
    private readonly pendingDocumentIndexes: PendingDocumentsIndexProvisioner
  ) {}

  /**
   * Garante os índices normativos antes de abrir a porta HTTP.
   *
   * Falhar aqui é intencional: iniciar sem as unicidades parciais permitiria
   * dados incompatíveis com o contrato do módulo.
   *
   * @returns Promessa resolvida quando todos os índices provisionados estão
   *   garantidos.
   * @throws Error quando o provisionamento de qualquer índice
   *   (colaboradores, tipos de documento ou vínculos) falha; a mensagem
   *   inclui o `code` da falha subjacente.
   */
  async $beforeListen(): Promise<void> {
    if (this.provisionCollaboratorIndexes) {
      const result = await this.collaboratorIndexes.ensure();
      if (result.isErr()) {
        throw new Error(`COLLABORATOR_INDEX_PROVISIONING_FAILED:${result.error.code}`);
      }
    }
    if (this.provisionDocumentTypeIndexes) {
      const result = await this.documentTypeIndexes.ensure();
      if (result.isErr()) {
        throw new Error(`DOCUMENT_TYPE_INDEX_PROVISIONING_FAILED:${result.error.code}`);
      }
    }
    if (this.provisionCollaboratorDocumentIndexes) {
      const result = await this.collaboratorDocumentIndexes.ensure();
      if (result.isErr()) {
        throw new Error(`COLLABORATOR_DOCUMENT_INDEX_PROVISIONING_FAILED:${result.error.code}`);
      }
    }
    if (this.provisionReportingIndexes) {
      const result = await this.pendingDocumentIndexes.ensure();
      if (result.isErr()) {
        throw new Error(`REPORTING_INDEX_PROVISIONING_FAILED:${result.error.code}`);
      }
    }
  }
}
