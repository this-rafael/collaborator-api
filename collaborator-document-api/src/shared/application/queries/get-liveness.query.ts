import type {HealthStatus} from "../../presentation/http/schemas/health-status.js";

export class GetLivenessQuery {
  execute(): HealthStatus {
    return {status: "ok"};
  }
}
