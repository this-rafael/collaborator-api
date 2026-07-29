import {Controller} from "@tsed/di";
import {ContentType, Description, Get, OperationId, Returns, Summary} from "@tsed/schema";
import {HeaderParams} from "@tsed/platform-params";
import {Res} from "@tsed/platform-http";
import type {Response} from "express";

import {DiscoverApiQuery} from "../shared/application/queries/discover-api.query.js";
import {MongoDiscoveryAvailability} from "../shared/infrastructure/availability/mongo-discovery-availability.js";
import {EtagService} from "../shared/presentation/http/cache/etag.service.js";
import {ProblemDetailsMapper} from "../shared/presentation/http/errors/problem-details.mapper.js";
import {getRequestTraceId} from "../shared/presentation/http/middlewares/request-id.middleware.js";
import {RateLimitMiddleware} from "../shared/presentation/http/middlewares/rate-limit.middleware.js";
import {apiRootPresenter} from "../shared/presentation/http/presenters/api-root.presenter.js";
import {ApiRoot} from "../shared/presentation/http/schemas/api-root.js";
import {ProblemDetails} from "../shared/presentation/http/schemas/problem-details.js";

function parseNonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

@Controller("/api/v1")
export class ApiRootController {
  private readonly query = new DiscoverApiQuery(new MongoDiscoveryAvailability());
  private readonly etagService = new EtagService();
  private readonly mapper = new ProblemDetailsMapper();
  private readonly rateLimiter = new RateLimitMiddleware({
    limit: parseNonNegativeInteger(process.env.RATE_LIMIT_GET, 60),
    windowMs: parsePositiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    operationId: "discoverApi"
  });

  @Get("/")
  @OperationId("discoverApi")
  @Summary("Descobrir os recursos da API")
  @Description("Retorna os pontos de entrada disponíveis para os consumidores da API.")
  @ContentType("application/hal+json")
  @(Returns(200, ApiRoot)
    .ContentType("application/hal+json")
    .Header("ETag", {$ref: "#/components/headers/ETag"} as never)
    .Description("Pontos de entrada e relações disponíveis."))
  @(Returns(304).Description("Representação semanticamente inalterada; sem corpo."))
  @(Returns(429, ProblemDetails)
    .ContentType("application/problem+json")
    .Header("Retry-After", {$ref: "#/components/headers/RetryAfter"} as never)
    .Description("Limite da operação excedido."))
  @(Returns(500, ProblemDetails)
    .ContentType("application/problem+json")
    .Description("Falha inesperada sanitizada."))
  @(Returns(503, ProblemDetails)
    .ContentType("application/problem+json")
    .Description("Dependência necessária temporariamente indisponível."))
  async discoverApi(
    @Res() res: Response,
    @HeaderParams("If-None-Match") ifNoneMatch?: string
  ): Promise<void> {
    const request = res.req!;
    const traceId = getRequestTraceId(request);

    try {
      if (process.env.NODE_ENV === "test") {
        const forcedFailure = process.env.DISCOVERY_TEST_FAILURE;
        if (forcedFailure === "internal") {
          this.writeProblem(res, "INTERNAL_SERVER_ERROR", traceId);
          return;
        }
        if (forcedFailure === "unavailable") {
          this.writeProblem(res, "SERVICE_UNAVAILABLE", traceId);
          return;
        }
      }

      if (!(await this.rateLimiter.handle(request, res))) {
        return;
      }

      const result = await this.query.execute();
      if (result.isErr()) {
        this.writeProblem(res, result.error.code, traceId);
        return;
      }

      const body = apiRootPresenter(result.value);
      const etag = this.etagService.compute(body);
      if (ifNoneMatch && this.etagService.matches(etag, ifNoneMatch)) {
        res.status(304);
        res.removeHeader("Content-Type");
        res.removeHeader("Content-Length");
        res.end();
        return;
      }

      res.setHeader("ETag", etag);
      res.type("application/hal+json").status(200).json(body);
    } catch (error) {
      void error;
      this.writeProblem(res, "INTERNAL_SERVER_ERROR", traceId);
    }
  }

  private writeProblem(res: Response, code: string, traceId: string): void {
    const {problem, retryAfter} = this.mapper.fromFailure({code}, {instance: "/api/v1", traceId});
    res.status(problem.status).type("application/problem+json");
    if (retryAfter) {
      res.setHeader("Retry-After", String(retryAfter));
    }
    res.json(problem);
  }
}
