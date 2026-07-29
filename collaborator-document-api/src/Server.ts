import cors from "cors";
import helmet from "helmet";

import {Configuration} from "@tsed/di";
import "@tsed/mongoose";
import "@tsed/platform-express";
import "@tsed/swagger";

import {HealthController} from "./controllers/health.controller.js";
import {ApiRootController} from "./controllers/api-root.controller.js";
import {CollaboratorsController} from "./modules/collaborators/presentation/collaborators.controller.js";
import {MongoIndexManager} from "./shared/infrastructure/persistence/mongodb/mongo-index-manager.js";
import {MongoTransactionManager} from "./shared/infrastructure/mongo/mongo-transaction.manager.js";
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
 * (MongoIndexManager, MongoTransactionManager, MongoReadinessCheck).
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
  imports: [MongoIndexManager, MongoTransactionManager, MongoReadinessCheck],
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
export class Server {}
