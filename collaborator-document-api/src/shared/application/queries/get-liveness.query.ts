import type {HealthStatus} from "../../presentation/http/schemas/health-status.js";

/**
 * Caso de uso de liveness probe.
 *
 * Sempre retorna `{status: "ok"}` — não depende de
 * serviços externos.
 */
export class GetLivenessQuery {
  execute(): HealthStatus {
    return {status: "ok"};
  }
}
