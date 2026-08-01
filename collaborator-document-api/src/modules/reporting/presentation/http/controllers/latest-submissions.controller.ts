import {Controller} from "@tsed/di";
import {Res} from "@tsed/platform-http";
import {HeaderParams, QueryParams} from "@tsed/platform-params";
import {ContentType, Description, Get, OperationId, Returns, Summary, Tags} from "@tsed/schema";
import type {Response} from "express";

import type {LatestSubmissionPosition} from "../../../application/models/latest-submission.view.js";
import type {LatestSubmissionPage} from "../../../application/ports/latest-submissions.read-model.js";
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
import {latestSubmissionPresenter} from "../presenters/reporting.presenter.js";
import {LatestSubmissionCollectionResponse} from "../schemas/latest-submission-response.schema.js";

const route = "/api/v1/submissions/latest";
const operationId = "listLatestSubmissions";
const order = "lastSubmittedAt:desc,_id:desc";
const filtersHash = "no-filters";
const invalidMessage = "One or more latest submission query parameters are invalid.";

/** Endpoint da coleção projetada dos últimos envios. */
@Controller(route)
@Tags("Submissions")
export class LatestSubmissionsController {
  private readonly etag = new EtagService();
  private readonly problems = new ProblemDetailsMapper();

  constructor(private readonly runtime: ReportingRuntime) {}

  @Get("/")
  @WithoutResponseContent(304)
  @OperationId(operationId)
  @Summary("Consultar o último envio de cada documento lógico")
  @Description(
    "Retorna um item por vínculo ativo SUBMITTED. Ordenação: lastSubmittedAt DESC e _id DESC."
  )
  @ContentType("application/hal+json")
  @(Returns(200, LatestSubmissionCollectionResponse)
    .ContentType("application/hal+json")
    .Header("ETag", {$ref: "#/components/headers/ETag"} as never)
    .Description("Página de últimos envios por documento lógico."))
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
      execute: (input) => this.runtime.listLatestSubmissions.execute(input),
      writePage: (page, limit, cursor, context) =>
        this.writePage(res, page, limit, cursor, context, ifNoneMatch)
    });
  }

  private writePage(
    res: Response,
    page: LatestSubmissionPage,
    limit: number,
    cursor: string | undefined,
    context: CursorContext,
    ifNoneMatch: string | undefined
  ): void {
    const items = page.items.map(latestSubmissionPresenter);
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
                  lastSubmittedAt: last.lastSubmittedAt,
                  id: last.documentId
                })
              }
            })
          )
        : undefined;
    writeHalWithEtag(
      res,
      {
        count: items.length,
        _embedded: {submissions: items},
        _links: next ? {self: {href: self}, next: {href: next}} : {self: {href: self}}
      },
      this.etag,
      ifNoneMatch
    );
  }
}

function encodePosition(position: LatestSubmissionPosition): string {
  return JSON.stringify(position);
}

function decodePosition(value: string): LatestSubmissionPosition | undefined {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed.lastSubmittedAt !== "string" || typeof parsed.id !== "string") {
      return undefined;
    }
    return {lastSubmittedAt: parsed.lastSubmittedAt, id: parsed.id};
  } catch {
    return undefined;
  }
}
