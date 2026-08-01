import {Controller} from "@tsed/di";
import {Res} from "@tsed/platform-http";
import {HeaderParams, QueryParams} from "@tsed/platform-params";
import {
  ContentType,
  Default,
  Description,
  Get,
  getJsonMethodStore,
  Integer,
  Maximum,
  Minimum,
  MinLength,
  OperationId,
  Returns,
  Summary,
  Tags
} from "@tsed/schema";
import type {Response} from "express";

import type {SubmissionEventPosition} from "../../../application/models/submission-event.view.js";
import type {SubmissionEventPage} from "../../../application/ports/submission-events.read-model.js";
import type {ListSubmissionEventsInput} from "../../../application/queries/list-submission-events.query.js";
import type {ReportingFailure} from "../../../application/reporting.failure.js";
import {ReportingRuntime} from "../../../reporting.runtime.js";
import {EtagService} from "../../../../../shared/presentation/http/cache/etag.service.js";
import {ProblemDetailsMapper} from "../../../../../shared/presentation/http/errors/problem-details.mapper.js";
import {getRequestTraceId} from "../../../../../shared/presentation/http/middlewares/request-id.middleware.js";
import {ProblemDetails} from "../../../../../shared/presentation/http/schemas/problem-details.js";
import {submissionEventPresenter} from "../presenters/reporting.presenter.js";
import {SubmissionEventCollectionResponse} from "../schemas/submission-event-response.schema.js";

const route = "/api/v1/submission-events";
const operationId = "listSubmissionEvents";
const order = "submittedAt:desc,documentId:desc,version:desc";
const filtersHash = "no-filters";

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
  @(Returns(304).Description("Representação inalterada."))
  @(Returns(400, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(429, ProblemDetails)
    .ContentType("application/problem+json")
    .Header("Retry-After", {$ref: "#/components/headers/RetryAfter"} as never))
  @(Returns(500, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(503, ProblemDetails).ContentType("application/problem+json"))
  async list(
    @QueryParams({expression: "cursor", useType: String, useValidation: false})
    @MinLength(1)
    cursor: string | undefined,
    @QueryParams({expression: "limit", useType: Number, useValidation: false})
    @Integer()
    @Minimum(1)
    @Maximum(100)
    @Default(20)
    rawLimit: string | undefined,
    @HeaderParams({expression: "If-None-Match", useType: String, useValidation: false})
    ifNoneMatch: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    const traceId = getRequestTraceId(res.req!);
    if (!(await this.runtime.rateLimiter(operationId).handle(res.req!, res))) return;

    const limit = rawLimit === undefined || rawLimit === "" ? 20 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return this.writeProblem(res, invalidCursorOrLimit("limit"), traceId);
    }
    if (cursor !== undefined && cursor.length === 0) {
      return this.writeProblem(res, invalidCursorOrLimit("cursor"), traceId);
    }

    const context = {operationId, filtersHash, order, limit};
    const decoded = cursor ? this.runtime.cursorCodec.decode(cursor, context) : undefined;
    if (decoded?.isErr()) {
      return this.writeProblem(res, invalidCursorOrLimit("cursor"), traceId);
    }
    const after = decoded?.isOk() ? decodePosition(decoded.value.position.id) : undefined;
    if (decoded?.isOk() && !after) {
      return this.writeProblem(res, invalidCursorOrLimit("cursor"), traceId);
    }

    const input: ListSubmissionEventsInput = {
      ...(cursor !== undefined ? {cursor} : {}),
      limit,
      ...(after ? {after} : {})
    };
    const result = await this.runtime.listSubmissionEvents.execute(input);
    result.match(
      (page) => this.writePage(res, page, limit, cursor, context, ifNoneMatch),
      (failure) => this.writeProblem(res, failure, traceId)
    );
  }

  private writePage(
    res: Response,
    page: SubmissionEventPage,
    limit: number,
    cursor: string | undefined,
    context: {operationId: string; filtersHash: string; order: string; limit: number},
    ifNoneMatch: string | undefined
  ): void {
    const items = page.items.map(submissionEventPresenter);
    const self = collectionHref(limit, cursor);
    const last = page.items.at(-1);
    const next =
      page.hasNext && last
        ? collectionHref(
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
    const body = {
      count: items.length,
      _embedded: {"submission-events": items},
      _links: next ? {self: {href: self}, next: {href: next}} : {self: {href: self}}
    };
    const etag = this.etag.compute(body);
    if (ifNoneMatch && this.etag.matches(etag, ifNoneMatch)) {
      this.notModified(res);
      return;
    }
    res.setHeader("ETag", etag);
    res.status(200).type("application/hal+json").json(body);
  }

  private notModified(res: Response): void {
    res.status(304);
    res.removeHeader("Content-Type");
    res.removeHeader("Content-Length");
    res.end();
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

function collectionHref(limit: number, cursor?: string): string {
  const query = new URLSearchParams({limit: String(limit)});
  if (cursor) query.set("cursor", cursor);
  return `${route}?${query.toString()}`;
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

function invalidCursorOrLimit(field: "cursor" | "limit"): ReportingFailure {
  return {
    code: "INVALID_QUERY_PARAMETER",
    message: "One or more submission event query parameters are invalid.",
    errors: [
      {
        field,
        code: field === "cursor" ? "INVALID_CURSOR" : "INVALID_LIMIT",
        message: `The ${field} query parameter is invalid.`
      }
    ]
  };
}

function WithoutResponseContent(status: number): MethodDecorator {
  return (target, propertyKey) => {
    getJsonMethodStore(target, propertyKey).operation.getResponseOf(status).delete("content");
  };
}
