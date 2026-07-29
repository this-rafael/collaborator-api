import {err, ok, type Result} from "neverthrow";

import type {HealthStatus} from "../../presentation/http/schemas/health-status.js";
import {ApplicationFailure} from "../application-failure.js";
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
  constructor(private readonly readiness: ReadinessCheck) {}

  async execute(): Promise<Result<HealthStatus, ApplicationFailure>> {
    let ready: boolean;
    try {
      ready = await this.readiness.isReady();
    } catch {
      ready = false;
    }

    if (!ready) {
      return err(new ApplicationFailure("SERVICE_UNAVAILABLE", READINESS_UNAVAILABLE));
    }

    return ok({status: "ok"});
  }
}
