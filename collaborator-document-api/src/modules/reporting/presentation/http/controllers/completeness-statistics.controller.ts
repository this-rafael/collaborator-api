import {Controller} from "@tsed/di";
import {Res} from "@tsed/platform-http";
import {HeaderParams} from "@tsed/platform-params";
import {ContentType, Description, Get, OperationId, Returns, Summary, Tags} from "@tsed/schema";
import type {Response} from "express";

import type {CompletenessStatisticsView} from "../../../application/models/completeness-statistics.view.js";
import {ReportingRuntime} from "../../../reporting.runtime.js";
import {EtagService} from "../../../../../shared/presentation/http/cache/etag.service.js";
import {WithoutResponseContent} from "../../../../../shared/presentation/http/decorators/without-response-content.js";
import {ProblemDetailsMapper} from "../../../../../shared/presentation/http/errors/problem-details.mapper.js";
import {getRequestTraceId} from "../../../../../shared/presentation/http/middlewares/request-id.middleware.js";
import {writeNotModified} from "../../../../../shared/presentation/http/responses/hal-etag-response.js";
import {ProblemDetails} from "../../../../../shared/presentation/http/schemas/problem-details.js";
import {writeReportingProblem} from "../helpers/reporting-list.helpers.js";
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
      (failure) => writeReportingProblem(res, this.problems, failure, traceId, route)
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
    const tag = this.etag.compute(semanticBody);
    if (ifNoneMatch && this.etag.matches(tag, ifNoneMatch)) {
      writeNotModified(res);
      return;
    }
    res.setHeader("ETag", tag);
    res.status(200).type("application/hal+json").json(body);
  }
}
