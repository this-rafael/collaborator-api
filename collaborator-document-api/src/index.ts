import {pathToFileURL} from "node:url";

import {$log} from "@tsed/logger";

import {startApplication, stopApplication} from "./bootstrap.js";
import {loadEnv} from "./config/env.js";

/**
 * Ponto de entrada da aplicação.
 *
 * Carrega as variáveis de ambiente, inicializa a plataforma
 * (Ts.ED + Express + Mongoose) e registra os handlers de
 * desligamento gracioso (SIGINT/SIGTERM). Retorna 0 em caso
 * de sucesso ou 1 se a inicialização falhar.
 */
export async function main(): Promise<number> {
  try {
    const platform = await startApplication(loadEnv());
    let stopping = false;
    const shutdown = async () => {
      if (stopping) return;
      stopping = true;
      await stopApplication(platform);
    };
    process.once("SIGINT", () => void shutdown());
    process.once("SIGTERM", () => void shutdown());
    return 0;
  } catch (error) {
    $log.error({
      event: "SERVER_BOOTSTRAP_ERROR",
      message: error instanceof Error ? error.message : "Unknown bootstrap error"
    });
    return 1;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
/* v8 ignore next 5 -- the compiled entrypoint is validated by test:smoke. */
if (entrypoint === import.meta.url) {
  void main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
