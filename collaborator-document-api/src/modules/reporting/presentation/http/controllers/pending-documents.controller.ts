import {createHash} from "node:crypto";

import {Controller} from "@tsed/di";
import {HeaderParams, QueryParams} from "@tsed/platform-params";
import {Res} from "@tsed/platform-http";
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
  Pattern,
  Returns,
  Summary,
  Tags
} from "@tsed/schema";
import type {Response} from "express";

import type {PendingDocumentPosition} from "../../../application/models/pending-document.view.js";
import {
  normalizePendingDocumentFilters,
  type ListPendingDocumentsInput
} from "../../../application/queries/list-pending-documents.query.js";
import type {ReportingFailure} from "../../../application/reporting.failure.js";
import {ReportingRuntime} from "../../../reporting.runtime.js";
import {EtagService} from "../../../../../shared/presentation/http/cache/etag.service.js";
import {ProblemDetailsMapper} from "../../../../../shared/presentation/http/errors/problem-details.mapper.js";
import {getRequestTraceId} from "../../../../../shared/presentation/http/middlewares/request-id.middleware.js";
import {ProblemDetails} from "../../../../../shared/presentation/http/schemas/problem-details.js";
import {pendingDocumentPresenter} from "../presenters/reporting.presenter.js";
import {PendingDocumentCollectionResponse} from "../schemas/pending-document-response.schema.js";

const operationId = "listPendingDocuments";
const order = "documentTypeId:asc,collaboratorId:asc,_id:asc";

/** Endpoint da coleção projetada de documentos pendentes. */
@Controller("/api/v1/pending-documents")
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
  @(Returns(304).Description("Representação inalterada."))
  @(Returns(400, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(429, ProblemDetails)
    .ContentType("application/problem+json")
    .Header("Retry-After", {$ref: "#/components/headers/RetryAfter"} as never))
  @(Returns(500, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(503, ProblemDetails).ContentType("application/problem+json"))
  async list(
    @QueryParams({expression: "collaboratorName", useType: String, useValidation: false})
    collaboratorName: string | undefined,
    @QueryParams({expression: "cpf", useType: String, useValidation: false})
    @Pattern(/^\d{11}$/)
    cpf: string | undefined,
    @QueryParams({expression: "documentTypeName", useType: String, useValidation: false})
    documentTypeName: string | undefined,
    @QueryParams({expression: "documentTypeCode", useType: String, useValidation: false})
    @Pattern(/^[A-Z][A-Z0-9_]{1,63}$/)
    documentTypeCode: string | undefined,
    @QueryParams({expression: "limit", useType: Number, useValidation: false})
    @Integer()
    @Minimum(1)
    @Maximum(100)
    @Default(20)
    rawLimit: string | undefined,
    @QueryParams({expression: "cursor", useType: String, useValidation: false})
    @MinLength(1)
    cursor: string | undefined,
    @HeaderParams({expression: "If-None-Match", useType: String, useValidation: false})
    ifNoneMatch: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    const traceId = getRequestTraceId(res.req!);
    if (!(await this.runtime.rateLimiter(operationId).handle(res.req!, res))) return;

    const limit = rawLimit === undefined || rawLimit === "" ? 20 : Number(rawLimit);
    const input: ListPendingDocumentsInput = {
      ...(collaboratorName !== undefined ? {collaboratorName} : {}),
      ...(cpf !== undefined ? {cpf} : {}),
      ...(documentTypeName !== undefined ? {documentTypeName} : {}),
      ...(documentTypeCode !== undefined ? {documentTypeCode} : {}),
      ...(cursor !== undefined ? {cursor} : {}),
      limit
    };
    const normalized = normalizePendingDocumentFilters(input);
    if (normalized.isErr()) return this.writeProblem(res, normalized.error, traceId);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return this.writeProblem(res, invalidCursorOrLimit("limit"), traceId);
    }
    if (cursor !== undefined && cursor.length === 0) {
      return this.writeProblem(res, invalidCursorOrLimit("cursor"), traceId);
    }

    const context = {
      operationId,
      filtersHash: createHash("sha256").update(JSON.stringify(normalized.value)).digest("hex"),
      order,
      limit
    };
    const decoded = cursor ? this.runtime.cursorCodec.decode(cursor, context) : undefined;
    if (decoded?.isErr()) {
      return this.writeProblem(res, invalidCursorOrLimit("cursor"), traceId);
    }
    const after = decoded?.isOk() ? decodePosition(decoded.value.position.id) : undefined;
    if (decoded?.isOk() && !after) {
      return this.writeProblem(res, invalidCursorOrLimit("cursor"), traceId);
    }

    const result = await this.runtime.listPendingDocuments.execute({
      ...input,
      ...(after ? {after} : {})
    });
    result.match(
      (page) => {
        const items = page.items.map(pendingDocumentPresenter);
        const selfQuery = queryFrom(normalized.value, limit, cursor);
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
        const body = {
          count: items.length,
          _embedded: {"pending-documents": items},
          _links: next ? {self: {href: self}, next: {href: next}} : {self: {href: self}}
        };
        const etag = this.etag.compute(body);
        if (ifNoneMatch && this.etag.matches(etag, ifNoneMatch)) {
          this.notModified(res);
          return;
        }
        res.setHeader("ETag", etag);
        res.status(200).type("application/hal+json").json(body);
      },
      (failure) => this.writeProblem(res, failure, traceId)
    );
  }

  private notModified(res: Response): void {
    res.status(304);
    res.removeHeader("Content-Type");
    res.removeHeader("Content-Length");
    res.end();
  }

  private writeProblem(res: Response, failure: ReportingFailure, traceId: string): void {
    const {problem, retryAfter} = this.problems.fromFailure(failure, {
      instance: res.req?.path ?? "/api/v1/pending-documents",
      traceId
    });
    res.status(problem.status).type("application/problem+json");
    if (retryAfter) res.setHeader("Retry-After", String(retryAfter));
    res.json(problem);
  }
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
  return `/api/v1/pending-documents?${query.toString()}`;
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

function invalidCursorOrLimit(field: "cursor" | "limit"): ReportingFailure {
  return {
    code: "INVALID_QUERY_PARAMETER",
    message: "One or more pending document query parameters are invalid.",
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
