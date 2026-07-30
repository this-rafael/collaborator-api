import {Controller} from "@tsed/di";
import {ContentType, Description, Get, OperationId, Returns, Summary, Tags} from "@tsed/schema";
import {Res} from "@tsed/platform-http";
import type {Response} from "express";

import {GetLivenessQuery} from "../shared/application/queries/get-liveness.query.js";
import {GetReadinessQuery} from "../shared/application/queries/get-readiness.query.js";
import {MongoReadinessCheck} from "../shared/infrastructure/availability/mongo-readiness-check.js";
import {HealthStatus} from "../shared/presentation/http/schemas/health-status.js";
import {ProblemDetails} from "../shared/presentation/http/schemas/problem-details.js";
import {ProblemDetailsMapper} from "../shared/presentation/http/errors/problem-details.mapper.js";
import {getRequestTraceId} from "../shared/presentation/http/middlewares/request-id.middleware.js";

/**
 * Controlador REST de health-check da aplicação.
 *
 * Expõe `GET /health/live` (liveness do processo, sem
 * dependências externas) e `GET /health/ready` (readiness,
 * verifica conexão MongoDB).
 */
@Controller("/health")
@Tags("Health")
export class HealthController {
  private readonly livenessQuery = new GetLivenessQuery();
  private readonly readinessQuery: GetReadinessQuery;
  private readonly mapper = new ProblemDetailsMapper();

  constructor(readinessCheck: MongoReadinessCheck) {
    this.readinessQuery = new GetReadinessQuery(readinessCheck);
  }

  @Get("/live")
  @OperationId("getLiveness")
  @Summary("Verificar liveness do processo")
  @Description(
    "Verifica somente se o processo está operacional. Não consulta MongoDB e não aplica HAL, ETag ou rate limit."
  )
  @ContentType("application/json")
  @(Returns(200, HealthStatus).ContentType("application/json").Description("Processo operacional."))
  /**
   * Verifica apenas se o processo está operacional (liveness).
   * Não consulta MongoDB. Sempre retorna 200 com
   * `{"status":"ok"}`.
   *
   * @param res - Objeto response Express.
   */
  live(@Res() res: Response): void {
    const body = this.livenessQuery.execute();
    res.status(200).type("application/json").end(JSON.stringify(body));
  }

  @Get("/ready")
  @OperationId("getReadiness")
  @Summary("Verificar readiness da aplicação")
  @Description(
    "Verifica a conexão MongoDB e se o ambiente está apto a receber tráfego. Não aplica HAL, ETag ou rate limit."
  )
  @ContentType("application/json")
  @(Returns(200, HealthStatus)
    .ContentType("application/json")
    .Description("Aplicação apta a receber tráfego."))
  @(Returns(503, ProblemDetails)
    .ContentType("application/problem+json")
    .Description("Dependência necessária temporariamente indisponível."))
  /**
   * Verifica se a aplicação está apta a receber tráfego
   * (readiness). Testa a conexão MongoDB e retorna 200
   * ou 503 com Problem Details.
   *
   * @param res - Objeto response Express.
   */
  async ready(@Res() res: Response): Promise<void> {
    const traceId = getRequestTraceId(res.req!);

    if (process.env.NODE_ENV === "test") {
      const forced = process.env.HEALTH_TEST_READINESS;
      if (forced === "available") {
        res
          .status(200)
          .type("application/json")
          .end(JSON.stringify({status: "ok"}));
        return;
      }
      if (forced === "unavailable") {
        const {problem} = this.mapper.fromFailure(
          {code: "SERVICE_UNAVAILABLE"},
          {instance: "/health/ready", traceId}
        );
        res.status(503).type("application/problem+json").end(JSON.stringify(problem));
        return;
      }
    }

    const result = await this.readinessQuery.execute();
    if (result.isErr()) {
      const {problem} = this.mapper.fromFailure(result.error, {
        instance: "/health/ready",
        traceId
      });
      res.status(503).type("application/problem+json").end(JSON.stringify(problem));
      return;
    }

    res.status(200).type("application/json").end(JSON.stringify(result.value));
  }
}
