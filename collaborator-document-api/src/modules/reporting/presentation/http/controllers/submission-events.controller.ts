import {Controller} from "@tsed/di";
import {Res} from "@tsed/platform-http";
import {HeaderParams, QueryParams} from "@tsed/platform-params";
import {ContentType, Description, Get, OperationId, Returns, Summary, Tags} from "@tsed/schema";
import type {Response} from "express";

import type {SubmissionEventPosition} from "../../../application/models/submission-event.view.js";
import type {SubmissionEventPage} from "../../../application/ports/submission-events.read-model.js";
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
import {submissionEventPresenter} from "../presenters/reporting.presenter.js";
import {SubmissionEventCollectionResponse} from "../schemas/submission-event-response.schema.js";

const route = "/api/v1/submission-events";
const operationId = "listSubmissionEvents";
const order = "submittedAt:desc,documentId:desc,version:desc";
const filtersHash = "no-filters";
const invalidMessage = "One or more submission event query parameters are invalid.";

/** Endpoint da coleção projetada de eventos de envio. */
@Controller(route)
@Tags("Submissions")
export class SubmissionEventsController {
  private readonly etag = new EtagService();
  private readonly problems = new ProblemDetailsMapper();

  constructor(private readonly runtime: ReportingRuntime) {}

  @Get("/")
  @WithoutResponseContent(304)
  @OperationId(operationId)
  @Summary("Consultar todos os eventos de envio")
  @Description(
    "Expõe cada elemento de versions como evento. Consulta baseada em unwind; mais custosa que /submissions/latest. Ordenação: submittedAt DESC, documentId DESC e version DESC."
  )
  @ContentType("application/hal+json")
  @(Returns(200, SubmissionEventCollectionResponse)
    .ContentType("application/hal+json")
    .Header("ETag", {$ref: "#/components/headers/ETag"} as never)
    .Description("Página de eventos individuais de envio."))
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
      execute: (input) => this.runtime.listSubmissionEvents.execute(input),
      writePage: (page, limit, cursor, context) =>
        this.writePage(res, page, limit, cursor, context, ifNoneMatch)
    });
  }

  private writePage(
    res: Response,
    page: SubmissionEventPage,
    limit: number,
    cursor: string | undefined,
    context: CursorContext,
    ifNoneMatch: string | undefined
  ): void {
    const items = page.items.map(submissionEventPresenter);
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
                  submittedAt: last.submittedAt,
                  documentId: last.documentId,
                  version: last.version
                })
              }
            })
          )
        : undefined;
    writeHalWithEtag(
      res,
      {
        count: items.length,
        _embedded: {"submission-events": items},
        _links: next ? {self: {href: self}, next: {href: next}} : {self: {href: self}}
      },
      this.etag,
      ifNoneMatch
    );
  }
}

function encodePosition(position: SubmissionEventPosition): string {
  return JSON.stringify(position);
}

function decodePosition(value: string): SubmissionEventPosition | undefined {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      typeof parsed.submittedAt !== "string" ||
      typeof parsed.documentId !== "string" ||
      typeof parsed.version !== "number"
    ) {
      return undefined;
    }
    return {
      submittedAt: parsed.submittedAt,
      documentId: parsed.documentId,
      version: parsed.version
    };
  } catch {
    return undefined;
  }
}
