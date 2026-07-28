import {Configuration} from "@tsed/di";
import "@tsed/mongoose";
import "@tsed/platform-express";

import {HealthController} from "./controllers/health.controller.js";
import {MongoIndexManager} from "./shared/infrastructure/persistence/mongodb/mongo-index-manager.js";
import {MongoTransactionManager} from "./shared/infrastructure/persistence/mongodb/mongo-transaction-manager.js";

@Configuration({
  httpsPort: false,
  acceptMimes: ["application/json"],
  mount: {"/": [HealthController]},
  imports: [MongoIndexManager, MongoTransactionManager],
  middlewares: ["json-parser", "urlencoded-parser"],
  exclude: ["**/*.spec.ts"]
})
export class Server {}
