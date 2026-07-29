import {$log} from "@tsed/logger";
import {PlatformExpress} from "@tsed/platform-express";

import type {AppEnv} from "./config/env.js";
import {Server} from "./Server.js";

type BootstrapEnv = Pick<AppEnv, "nodeEnv" | "port" | "mongodbUri" | "logLevel"> &
  Partial<Pick<AppEnv, "cors" | "rateLimit" | "openapi">>;

export function serverSettings(env: BootstrapEnv) {
  return {
    httpPort: env.port,
    logger: {level: env.logLevel},
    mongoose: [
      {
        id: "default",
        url: env.mongodbUri,
        connectionOptions: {}
      }
    ]
  };
}

export async function startApplication(env: BootstrapEnv) {
  const platform = await PlatformExpress.bootstrap(Server, serverSettings(env));
  await platform.listen();
  $log.info({event: "SERVER_STARTED", port: env.port});
  return platform;
}

export async function stopApplication(platform: {stop: () => Promise<unknown>}) {
  await platform.stop();
}
