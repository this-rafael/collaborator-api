import {err, ok, type Result} from "neverthrow";

import type {HealthStatus} from "../../presentation/http/schemas/health-status.js";
import {applicationFailure, type ApplicationFailure} from "../errors/application-failure.js";
import type {ReadinessCheck} from "../ports/readiness-check.js";

const READINESS_UNAVAILABLE = "A dependência necessária está temporariamente indisponível.";

/**
 * Caso de uso de readiness probe.
 *
 * Verifica a disponibilidade da dependência (MongoDB) via
 * `ReadinessCheck` e retorna `{status: "ok"}` ou
 * `ApplicationFailure` com código `SERVICE_UNAVAILABLE`.
 */
export class GetReadinessQuery {
  /**
   * @param readiness - Porta que verifica a saúde das dependências críticas.
   */
  constructor(private readonly readiness: ReadinessCheck) {}

  /**
   * Executa a verificação de readiness, tolerando exceções da dependência
   * (que são tratadas como "não pronto").
   *
   * @returns Result com `{status: "ok"}` em sucesso; em falha,
   *   ApplicationFailure com código SERVICE_UNAVAILABLE quando a dependência
   *   está indisponível.
   */
  async execute(): Promise<Result<HealthStatus, ApplicationFailure>> {
    let ready: boolean;
    try {
      ready = await this.readiness.isReady();
    } catch {
      ready = false;
    }

    if (!ready) {
      return err(applicationFailure("SERVICE_UNAVAILABLE", READINESS_UNAVAILABLE));
    }

    return ok({status: "ok"});
  }
}
