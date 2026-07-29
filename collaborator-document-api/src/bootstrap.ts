import {$log} from "@tsed/logger";
import {PlatformExpress} from "@tsed/platform-express";

import type {AppEnv} from "./config/env.js";
import {Server} from "./Server.js";

type BootstrapEnv = Pick<AppEnv, "nodeEnv" | "port" | "mongodbUri" | "logLevel"> &
  Partial<Pick<AppEnv, "cors" | "rateLimit" | "openapi">>;

/**
 * Monta o objeto de configuração do servidor Ts.ED a partir
 * das variáveis de ambiente fornecidas.
 *
 * @param env - Subconjunto de variáveis de ambiente usadas
 *   na inicialização (`nodeEnv`, `port`, `mongodbUri`,
 *   `logLevel` e opcionais `cors`, `rateLimit`, `openapi`).
 * @returns Objeto com as seções `httpPort`, `logger` e
 *   `mongoose` consumidas pelo bootstrap do Ts.ED.
 */
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

/**
 * Inicializa a aplicação: faz o bootstrap do Ts.ED com a
 * classe {@link Server} e as configurações obtidas de
 * `serverSettings`, escuta na porta definida e loga o
 * evento de sucesso.
 *
 * @param env - Mesmo formato aceito por `serverSettings`.
 * @returns A plataforma Ts.ED já ouvindo na porta
 *   configurada.
 */
export async function startApplication(env: BootstrapEnv) {
  const platform = await PlatformExpress.bootstrap(Server, serverSettings(env));
  await platform.listen();
  $log.info({event: "SERVER_STARTED", port: env.port});
  return platform;
}

/**
 * Para a aplicação de forma graciosa chamando `platform.stop()`.
 *
 * @param platform - Objeto com método `stop` retornado por
 *   `startApplication`.
 */
export async function stopApplication(platform: {stop: () => Promise<unknown>}) {
  await platform.stop();
}
