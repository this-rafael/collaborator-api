import {Configuration} from "@tsed/di";
import "@tsed/platform-express";

import {loadEnv} from "./config/index.js";
import {HealthController} from "./controllers/health.controller.js";

const env = loadEnv();

@Configuration({
  httpPort: env.port,
  httpsPort: false,
  acceptMimes: ["application/json"],
  mount: {
    "/": [HealthController]
  },
  middlewares: ["json-parser", "urlencoded-parser"],
  exclude: ["**/*.spec.ts"]
})
export class Server {}
