import cors from "cors";
import helmet from "helmet";

import {Configuration} from "@tsed/di";
import "@tsed/mongoose";
import "@tsed/platform-express";
import "@tsed/swagger";

import {HealthController} from "./controllers/health.controller.js";
import {ApiRootController} from "./controllers/api-root.controller.js";
import {MongoIndexManager} from "./shared/infrastructure/persistence/mongodb/mongo-index-manager.js";
import {MongoTransactionManager} from "./shared/infrastructure/persistence/mongodb/mongo-transaction-manager.js";
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

@Configuration({
  httpsPort: false,
  settings: {"trust proxy": false},
  swagger: [openApiSettings],
  acceptMimes: ["application/json", "application/hal+json", "application/problem+json"],
  mount: {
    "/": [HealthController, ApiRootController]
  },
  imports: [MongoIndexManager, MongoTransactionManager],
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
