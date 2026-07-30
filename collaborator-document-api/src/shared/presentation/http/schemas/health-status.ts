import {AdditionalProperties, Enum, Property, Required} from "@tsed/schema";

/**
 * Schema do status de health check.
 *
 * @remarks Usado como tipo de resposta dos endpoints
 *   `GET /health/live` e `GET /health/ready`.
 */
@AdditionalProperties(false)
export class HealthStatus {
  @Required()
  @Enum("ok")
  @Property(String)
  status!: string;
}
