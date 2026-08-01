import {Controller} from "@tsed/di";
import {Res} from "@tsed/platform-http";
import {HeaderParams, QueryParams} from "@tsed/platform-params";
import {ContentType, Description, Get, OperationId, Returns, Summary, Tags} from "@tsed/schema";
import type {Response} from "express";

import type {PendingDocumentTypeStatisticPosition} from "../../../application/models/pending-document-type-statistic.view.js";
import type {PendingDocumentTypeStatisticsPage} from "../../../application/ports/pending-document-type-statistics.read-model.js";
import {ReportingRuntime} from "../../../reporting.runtime.js";
import type {CursorContext} from "../../../../../shared/application/pagination/cursor-codec.js";
import {EtagService} from "../../../../../shared/presentation/http/cache/etag.service.js";
import {WithoutResponseContent} from "../../../../../shared/presentation/http/decorators/without-response-content.js";
import {ProblemDetailsMapper} from "../../../../../shared/presentation/http/errors/problem-details.mapper.js";
import {writeHalWithEtag} from "../../../../../shared/presentation/http/responses/hal-etag-response.js";
import {KeysetPageQueryDto} from "../dtos/keyset-page.query.dto.js";
import {
  collectionHref,
  ReportingListErrorResponses,
  runReportingKeysetList
} from "../helpers/reporting-list.helpers.js";
import {pendingDocumentTypeStatisticPresenter} from "../presenters/reporting.presenter.js";
import {PendingDocumentTypeStatisticsCollectionResponse} from "../schemas/pending-document-type-statistics-response.schema.js";

const route = "/api/v1/statistics/pending-document-types";
const operationId = "listPendingDocumentTypeStatistics";
const order = "pendingCount:desc,documentTypeId:asc";
const filtersHash = "no-filters";
const invalidMessage = "One or more pending document type statistic query parameters are invalid.";

/** Endpoint do ranking agregado de tipos de documento com pendências. */
@Controller(route)
@Tags("Statistics")
export class PendingDocumentTypeStatisticsController {
  private readonly etag = new EtagService();
  private readonly problems = new ProblemDetailsMapper();

  constructor(private readonly runtime: ReportingRuntime) {}

  @Get("/")
  @WithoutResponseContent(304)
  @OperationId(operationId)
  @Summary("Consultar tipos com mais pendências")
  @Description("Ordenação total por pendingCount DESC e documentTypeId ASC como desempate.")
  @ContentType("application/hal+json")
  @(Returns(200, PendingDocumentTypeStatisticsCollectionResponse)
    .ContentType("application/hal+json")
    .Header("ETag", {$ref: "#/components/headers/ETag"} as never)
    .Description("Página de tipos de documento ordenados por quantidade de pendências."))
  @ReportingListErrorResponses()
  async list(
    @QueryParams({useValidation: false}) query: KeysetPageQueryDto,
    @HeaderParams({expression: "If-None-Match", useType: String, useValidation: false})
    ifNoneMatch: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    await runReportingKeysetList({
      res,
      operationId,
      route,
      query,
      problems: this.problems,
      rateLimiter: this.runtime.rateLimiter(operationId),
      codec: this.runtime.cursorCodec,
      contextBase: {operationId, filtersHash, order},
      decodePosition,
      invalidMessage,
      execute: (input) => this.runtime.listPendingDocumentTypeStatistics.execute(input),
      writePage: (page, limit, cursor, context) =>
        this.writePage(res, page, limit, cursor, context, ifNoneMatch)
    });
  }

  private writePage(
    res: Response,
    page: PendingDocumentTypeStatisticsPage,
    limit: number,
    cursor: string | undefined,
    context: CursorContext,
    ifNoneMatch: string | undefined
  ): void {
    const items = page.items.map(pendingDocumentTypeStatisticPresenter);
    const self = collectionHref(route, limit, cursor);
    const last = page.items.at(-1);
    const next =
      page.hasNext && last
        ? collectionHref(
            route,
            limit,
            this.runtime.cursorCodec.encode({
              ...context,
              position: {
                id: encodePosition({
                  pendingCount: last.pendingCount,
                  documentTypeId: last.documentType.id
                })
              }
            })
          )
        : undefined;
    writeHalWithEtag(
      res,
      {
        count: items.length,
        _embedded: {"document-types": items},
        _links: next ? {self: {href: self}, next: {href: next}} : {self: {href: self}}
      },
      this.etag,
      ifNoneMatch
    );
  }
}

function encodePosition(position: PendingDocumentTypeStatisticPosition): string {
  return JSON.stringify(position);
}

function decodePosition(value: string): PendingDocumentTypeStatisticPosition | undefined {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed.pendingCount !== "number" || typeof parsed.documentTypeId !== "string") {
      return undefined;
    }
    return {pendingCount: parsed.pendingCount, documentTypeId: parsed.documentTypeId};
  } catch {
    return undefined;
  }
}
