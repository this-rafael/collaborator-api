import type {HealthStatus} from "../../presentation/http/schemas/health-status.js";

/**
 * Caso de uso de liveness probe.
 *
 * Sempre retorna `{status: "ok"}` — não depende de
 * serviços externos.
 */
export class GetLivenessQuery {
  /**
   * Executa a verificação de liveness.
   *
   * @returns Sempre `{status: "ok"}`, indicando que o processo está vivo.
   */
  execute(): HealthStatus {
    return {status: "ok"};
  }
}
