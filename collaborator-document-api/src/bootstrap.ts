import {$log} from "@tsed/logger";
import {PlatformExpress} from "@tsed/platform-express";

import type {AppEnv} from "./config/env.js";
import {Server} from "./Server.js";

export function serverSettings(env: AppEnv) {
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

export async function startApplication(env: AppEnv) {
  const platform = await PlatformExpress.bootstrap(Server, serverSettings(env));
  await platform.listen();
  $log.info({event: "SERVER_STARTED", port: env.port});
  return platform;
}

export async function stopApplication(platform: {stop: () => Promise<unknown>}) {
  await platform.stop();
}
