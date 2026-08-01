import {createHash} from "node:crypto";

import {Controller} from "@tsed/di";
import {HeaderParams, QueryParams} from "@tsed/platform-params";
import {Res} from "@tsed/platform-http";
import {ContentType, Description, Get, OperationId, Returns, Summary, Tags} from "@tsed/schema";
import type {Response} from "express";

import type {PendingDocumentPosition} from "../../../application/models/pending-document.view.js";
import type {PendingDocumentPage} from "../../../application/ports/pending-documents.read-model.js";
import {
  normalizePendingDocumentFilters,
  type ListPendingDocumentsInput
} from "../../../application/queries/list-pending-documents.query.js";
import {ReportingRuntime} from "../../../reporting.runtime.js";
import type {CursorContext} from "../../../../../shared/application/pagination/cursor-codec.js";
import {EtagService} from "../../../../../shared/presentation/http/cache/etag.service.js";
import {WithoutResponseContent} from "../../../../../shared/presentation/http/decorators/without-response-content.js";
import {ProblemDetailsMapper} from "../../../../../shared/presentation/http/errors/problem-details.mapper.js";
import {getRequestTraceId} from "../../../../../shared/presentation/http/middlewares/request-id.middleware.js";
import {writeHalWithEtag} from "../../../../../shared/presentation/http/responses/hal-etag-response.js";
import {ListPendingDocumentsQueryDto} from "../dtos/list-pending-documents.query.dto.js";
import {
  resolveListCursor,
  ReportingListErrorResponses,
  writeReportingProblem
} from "../helpers/reporting-list.helpers.js";
import {pendingDocumentPresenter} from "../presenters/reporting.presenter.js";
import {PendingDocumentCollectionResponse} from "../schemas/pending-document-response.schema.js";

const operationId = "listPendingDocuments";
const route = "/api/v1/pending-documents";
const order = "documentTypeId:asc,collaboratorId:asc,_id:asc";
const invalidMessage = "One or more pending document query parameters are invalid.";

/** Endpoint da coleção projetada de documentos pendentes. */
@Controller(route)
@Tags("Queries")
export class PendingDocumentsController {
  private readonly etag = new EtagService();
  private readonly problems = new ProblemDetailsMapper();

  constructor(private readonly runtime: ReportingRuntime) {}

  @Get("/")
  @WithoutResponseContent(304)
  @OperationId(operationId)
  @Summary("Consultar documentos pendentes")
  @Description("Consulta vínculos pendentes ativos por filtros combinados e paginação keyset.")
  @ContentType("application/hal+json")
  @(Returns(200, PendingDocumentCollectionResponse)
    .ContentType("application/hal+json")
    .Header("ETag", {$ref: "#/components/headers/ETag"} as never)
    .Description("Página de documentos pendentes."))
  @ReportingListErrorResponses()
  async list(
    @QueryParams({useValidation: false}) query: ListPendingDocumentsQueryDto,
    @HeaderParams({expression: "If-None-Match", useType: String, useValidation: false})
    ifNoneMatch: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    const traceId = getRequestTraceId(res.req!);
    if (!(await this.runtime.rateLimiter(operationId).handle(res.req!, res))) return;

    const input = toListInput(query);
    const normalized = normalizePendingDocumentFilters(input);
    if (normalized.isErr()) {
      return writeReportingProblem(res, this.problems, normalized.error, traceId, route);
    }

    const resolved = resolveListCursor({
      rawLimit: query.limit,
      cursor: query.cursor,
      codec: this.runtime.cursorCodec,
      contextBase: {
        operationId,
        filtersHash: createHash("sha256").update(JSON.stringify(normalized.value)).digest("hex"),
        order
      },
      decodePosition,
      invalidMessage
    });
    if (!resolved.ok) {
      return writeReportingProblem(res, this.problems, resolved.failure, traceId, route);
    }

    const {limit, context, after} = resolved;
    const result = await this.runtime.listPendingDocuments.execute({
      ...input,
      ...(after ? {after} : {})
    });
    result.match(
      (page) =>
        this.writePage(res, page, normalized.value, limit, query.cursor, context, ifNoneMatch),
      (failure) => writeReportingProblem(res, this.problems, failure, traceId, route)
    );
  }

  private writePage(
    res: Response,
    page: PendingDocumentPage,
    filters: Record<string, unknown>,
    limit: number,
    cursor: string | undefined,
    context: CursorContext,
    ifNoneMatch: string | undefined
  ): void {
    const items = page.items.map(pendingDocumentPresenter);
    const selfQuery = queryFrom(filters, limit, cursor);
    const self = collectionHref(selfQuery);
    const last = page.items.at(-1);
    const next =
      page.hasNext && last
        ? nextHref(
            selfQuery,
            this.runtime.cursorCodec.encode({
              ...context,
              position: {
                id: encodePosition({
                  documentTypeId: last.documentType.id,
                  collaboratorId: last.collaborator.id,
                  id: last.id
                })
              }
            })
          )
        : undefined;
    writeHalWithEtag(
      res,
      {
        count: items.length,
        _embedded: {"pending-documents": items},
        _links: next ? {self: {href: self}, next: {href: next}} : {self: {href: self}}
      },
      this.etag,
      ifNoneMatch
    );
  }
}

function toListInput(query: ListPendingDocumentsQueryDto): ListPendingDocumentsInput {
  const {collaboratorName, cpf, documentTypeName, documentTypeCode, cursor} = query;
  const rawLimit = query.limit;
  const limit = rawLimit === undefined || rawLimit === "" ? 20 : Number(rawLimit);
  return {
    ...(collaboratorName !== undefined ? {collaboratorName} : {}),
    ...(cpf !== undefined ? {cpf} : {}),
    ...(documentTypeName !== undefined ? {documentTypeName} : {}),
    ...(documentTypeCode !== undefined ? {documentTypeCode} : {}),
    ...(cursor !== undefined ? {cursor} : {}),
    limit
  };
}

function queryFrom(
  filters: Record<string, unknown>,
  limit: number,
  cursor: string | undefined
): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (key !== "status" && key !== "deletedAt" && key !== "unlinkedAt") {
      query.set(key, String(value));
    }
  }
  query.set("limit", String(limit));
  if (cursor) query.set("cursor", cursor);
  return query;
}

function collectionHref(query: URLSearchParams): string {
  return `${route}?${query.toString()}`;
}

function nextHref(query: URLSearchParams, cursor: string): string {
  const next = new URLSearchParams(query);
  next.set("cursor", cursor);
  return collectionHref(next);
}

function encodePosition(position: PendingDocumentPosition): string {
  return JSON.stringify(position);
}

function decodePosition(value: string): PendingDocumentPosition | undefined {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      typeof parsed.documentTypeId !== "string" ||
      typeof parsed.collaboratorId !== "string" ||
      typeof parsed.id !== "string"
    ) {
      return undefined;
    }
    return {
      documentTypeId: parsed.documentTypeId,
      collaboratorId: parsed.collaboratorId,
      id: parsed.id
    };
  } catch {
    return undefined;
  }
}
