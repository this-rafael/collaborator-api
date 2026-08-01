import {Controller} from "@tsed/di";
import {Res} from "@tsed/platform-http";
import {HeaderParams} from "@tsed/platform-params";
import {
  ContentType,
  Description,
  Get,
  getJsonMethodStore,
  OperationId,
  Returns,
  Summary,
  Tags
} from "@tsed/schema";
import type {Response} from "express";

import type {CompletenessStatisticsView} from "../../../application/models/completeness-statistics.view.js";
import type {ReportingFailure} from "../../../application/reporting.failure.js";
import {ReportingRuntime} from "../../../reporting.runtime.js";
import {EtagService} from "../../../../../shared/presentation/http/cache/etag.service.js";
import {ProblemDetailsMapper} from "../../../../../shared/presentation/http/errors/problem-details.mapper.js";
import {getRequestTraceId} from "../../../../../shared/presentation/http/middlewares/request-id.middleware.js";
import {ProblemDetails} from "../../../../../shared/presentation/http/schemas/problem-details.js";
import {CompletenessStatisticsResponse} from "../schemas/completeness-statistics-response.schema.js";

const operationId = "getCompletenessStatistics";
const route = "/api/v1/statistics/completeness";

/** Endpoint da estatística global de completude documental. */
@Controller(route)
@Tags("Statistics")
export class CompletenessStatisticsController {
  private readonly etag = new EtagService();
  private readonly problems = new ProblemDetailsMapper();

  constructor(private readonly runtime: ReportingRuntime) {}

  @Get("/")
  @WithoutResponseContent(304)
  @OperationId(operationId)
  @Summary("Consultar completude global")
  @Description("Calcula o percentual de vínculos ativos enviados sobre o total de vínculos ativos.")
  @ContentType("application/hal+json")
  @(Returns(200, CompletenessStatisticsResponse)
    .ContentType("application/hal+json")
    .Header("ETag", {$ref: "#/components/headers/ETag"} as never)
    .Description("Estatística global de completude."))
  @(Returns(304).Description("Representação inalterada."))
  @(Returns(429, ProblemDetails)
    .ContentType("application/problem+json")
    .Header("Retry-After", {$ref: "#/components/headers/RetryAfter"} as never))
  @(Returns(500, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(503, ProblemDetails).ContentType("application/problem+json"))
  async get(
    @HeaderParams({expression: "If-None-Match", useType: String, useValidation: false})
    ifNoneMatch: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    const traceId = getRequestTraceId(res.req!);
    if (!(await this.runtime.rateLimiter(operationId).handle(res.req!, res))) return;

    const result = await this.runtime.getCompletenessStatistics.execute();
    result.match(
      (statistics) => this.writeStatistics(res, statistics, ifNoneMatch),
      (failure) => this.writeProblem(res, failure, traceId)
    );
  }

  private writeStatistics(
    res: Response,
    statistics: CompletenessStatisticsView,
    ifNoneMatch: string | undefined
  ): void {
    const body = {
      ...statistics,
      _links: {
        self: {href: route},
        "pending-documents": {href: "/api/v1/pending-documents"},
        "pending-document-types": {href: "/api/v1/statistics/pending-document-types"}
      }
    };
    const {calculatedAt: _calculatedAt, ...semanticBody} = body;
    const etag = this.etag.compute(semanticBody);

    if (ifNoneMatch && this.etag.matches(etag, ifNoneMatch)) {
      res.status(304);
      res.removeHeader("Content-Type");
      res.removeHeader("Content-Length");
      res.end();
      return;
    }

    res.setHeader("ETag", etag);
    res.status(200).type("application/hal+json").json(body);
  }

  private writeProblem(res: Response, failure: ReportingFailure, traceId: string): void {
    const {problem, retryAfter} = this.problems.fromFailure(failure, {
      instance: res.req?.path ?? route,
      traceId
    });
    res.status(problem.status).type("application/problem+json");
    if (retryAfter) res.setHeader("Retry-After", String(retryAfter));
    res.json(problem);
  }
}

function WithoutResponseContent(status: number): MethodDecorator {
  return (target, propertyKey) => {
    getJsonMethodStore(target, propertyKey).operation.getResponseOf(status).delete("content");
  };
}
