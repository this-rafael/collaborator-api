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
import {MongoReadinessCheck} from "./shared/infrastructure/availability/mongo-readiness-check.js";
import {globalErrorMiddleware} from "./shared/presentation/http/filters/global-error.filter.js";
import {requestIdMiddleware} from "./shared/presentation/http/middlewares/request-id.middleware.js";
import {requestObservabilityMiddleware} from "./shared/presentation/http/middlewares/request-observability.middleware.js";
import {openApiSettings} from "./config/openapi.js";

const corsAllowlist = (process.env.CORS_ALLOWLIST ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || corsAllowlist.includes(origin)) {
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
    "/": [HealthController, ApiRootController, CollaboratorsController]
  },
  imports: [CollaboratorsModule, MongoReadinessCheck],
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

  constructor(private readonly collaboratorIndexes: CollaboratorIndexProvisioner) {}

  /**
   * Garante os índices normativos antes de abrir a porta HTTP.
   *
   * Falhar aqui é intencional: iniciar sem as unicidades parciais permitiria
   * dados incompatíveis com o contrato do módulo.
   */
  async $beforeListen(): Promise<void> {
    if (!this.provisionCollaboratorIndexes) return;
    const result = await this.collaboratorIndexes.ensure();
    if (result.isErr()) {
      throw new Error(`COLLABORATOR_INDEX_PROVISIONING_FAILED:${result.error.code}`);
    }
  }
}
