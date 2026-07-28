import {$log} from "@tsed/logger";
import {PlatformExpress} from "@tsed/platform-express";

import {Server} from "./Server.js";

async function bootstrap() {
  try {
    const platform = await PlatformExpress.bootstrap(Server);
    await platform.listen();

    $log.info("Server initialized");
  } catch (error) {
    $log.error({
      event: "SERVER_BOOTSTRAP_ERROR",
      message: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

void bootstrap();
