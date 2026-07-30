import {createHash} from "node:crypto";

import {Controller} from "@tsed/di";
import {BodyParams, HeaderParams, PathParams, QueryParams} from "@tsed/platform-params";
import {Req, Res} from "@tsed/platform-http";
import {
  ContentType,
  Delete,
  Description,
  Get,
  OperationId,
  Patch,
  Post,
  Returns,
  Summary,
  Tags
} from "@tsed/schema";
import type {Request, Response} from "express";
import {err, ok, type Result} from "neverthrow";

import {normalizeDocumentTypeFilters} from "../../../application/use-cases/list-document-types.use-case.js";
import {DocumentTypesRuntime} from "../../../document-types.runtime.js";
import type {FieldError} from "../../../../../shared/presentation/http/schemas/problem-details.js";
import {EtagService} from "../../../../../shared/presentation/http/cache/etag.service.js";
import {ProblemDetailsMapper} from "../../../../../shared/presentation/http/errors/problem-details.mapper.js";
import {getRequestTraceId} from "../../../../../shared/presentation/http/middlewares/request-id.middleware.js";
import {ProblemDetails} from "../../../../../shared/presentation/http/schemas/problem-details.js";
import {CreateDocumentTypeDto} from "../dtos/create-document-type.dto.js";
import {UpdateDocumentTypeDto} from "../dtos/update-document-type.dto.js";
import {documentTypePresenter} from "../presenters/document-type.presenter.js";
import {
  DocumentTypeCollectionResponse,
  DocumentTypeResponse
} from "../schemas/document-type-response.schema.js";

type HttpFailure = Readonly<{
  code: string;
  kind?: string;
  message?: string;
  errors?: readonly FieldError[];
}>;

const objectIdPattern = /^[a-f\d]{24}$/i;

/** Controlador REST para operações CRUD de tipos de documento. */
@Controller("/api/v1/document-types")
@Tags("Document Types")
export class DocumentTypesController {
  private readonly etag = new EtagService();
  private readonly mapper = new ProblemDetailsMapper();

  constructor(private readonly runtime: DocumentTypesRuntime) {}

  @Post("/")
  @OperationId("createDocumentType")
  @Summary("Criar tipo de documento")
  @Description("Cria um tipo de documento ativo.")
  @ContentType("application/hal+json")
  @(Returns(201, DocumentTypeResponse)
    .ContentType("application/hal+json")
    .Header("Location", {$ref: "#/components/headers/Location"} as never)
    .Header("ETag", {$ref: "#/components/headers/ETag"} as never)
    .Description("Tipo de documento criado."))
  @(Returns(400, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(409, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(415, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(422, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(429, ProblemDetails)
    .ContentType("application/problem+json")
    .Header("Retry-After", {$ref: "#/components/headers/RetryAfter"} as never))
  @(Returns(500, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(503, ProblemDetails).ContentType("application/problem+json"))
  async create(
    @BodyParams({useValidation: false}) _dto: CreateDocumentTypeDto,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const traceId = getRequestTraceId(res.req!);
    if (!(await this.runtime.rateLimiter("createDocumentType", "write").handle(res.req!, res)))
      return;
    if (!isJsonRequest(res))
      return this.writeProblem(res, {code: "UNSUPPORTED_MEDIA_TYPE"}, traceId);
    const body = req.body as unknown;
    if (!isCreateBody(body)) return this.writeProblem(res, validationFailure(body), traceId);

    const result = await this.runtime.application.create.execute(
      body as {name: unknown; code: unknown; description?: unknown}
    );
    if (result.isErr()) {
      return this.writeProblem(res, withValidationField(result.error, body), traceId);
    }

    const representation = documentTypePresenter(result.value);
    res.setHeader("Location", representation._links.self.href);
    res.setHeader("ETag", this.etag.compute(representation));
    res.status(201).type("application/hal+json").json(representation);
  }

  @Get("/")
  @OperationId("listDocumentTypes")
  @Summary("Listar tipos de documento ativos")
  @Description("Lista tipos ativos por paginação keyset; filtros são combinados por AND.")
  @ContentType("application/hal+json")
  @(Returns(200, DocumentTypeCollectionResponse)
    .ContentType("application/hal+json")
    .Header("ETag", {$ref: "#/components/headers/ETag"} as never))
  @(Returns(304).Description("Representação inalterada."))
  @(Returns(400, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(429, ProblemDetails)
    .ContentType("application/problem+json")
    .Header("Retry-After", {$ref: "#/components/headers/RetryAfter"} as never))
  @(Returns(500, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(503, ProblemDetails).ContentType("application/problem+json"))
  async list(
    @QueryParams({expression: "name", useType: String, useValidation: false})
    name: string | undefined,
    @QueryParams({expression: "code", useType: String, useValidation: false})
    code: string | undefined,
    @QueryParams({expression: "limit", useType: String, useValidation: false})
    rawLimit: string | undefined,
    @QueryParams({expression: "cursor", useType: String, useValidation: false})
    rawCursor: string | undefined,
    @HeaderParams("If-None-Match") ifNoneMatch: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    const traceId = getRequestTraceId(res.req!);
    if (!(await this.runtime.rateLimiter("listDocumentTypes", "read").handle(res.req!, res)))
      return;

    const parsed = parseDocumentTypeListQuery(rawLimit, rawCursor, name, code);
    if (parsed.isErr()) return this.writeProblem(res, parsed.error, traceId);

    const {limit, cursor, filters} = parsed.value;
    const normalizedFilters = normalizeDocumentTypeFilters(filters);
    if (normalizedFilters.isErr()) {
      return this.writeProblem(
        res,
        resolveFilterFailure(normalizedFilters.error, filters),
        traceId
      );
    }

    const context = {
      operationId: "listDocumentTypes",
      filtersHash: createHash("sha256")
        .update(JSON.stringify(normalizedFilters.value))
        .digest("hex"),
      order: "_id:asc",
      limit
    };
    const decoded = cursor ? this.runtime.cursorCodec.decode(cursor, context) : undefined;
    if (decoded?.isErr()) return this.writeProblem(res, invalidQueryFailure("cursor"), traceId);

    const result = await this.runtime.application.list.execute({
      filters,
      limit,
      afterId: decoded?.isOk() ? decoded.value.position.id : undefined
    });
    if (result.isErr()) return this.writeProblem(res, result.error, traceId);

    const items = result.value.items.map(documentTypePresenter);
    const selfQuery = new URLSearchParams();
    for (const [key, value] of Object.entries(normalizedFilters.value)) {
      if (value) selfQuery.set(key, value);
    }
    selfQuery.set("limit", String(limit));
    if (cursor) selfQuery.set("cursor", cursor);
    const self = `/api/v1/document-types?${selfQuery.toString()}`;
    const lastId = result.value.items.at(-1)?.id;
    const next =
      result.value.hasNext && lastId
        ? listNextHref(
            selfQuery,
            this.runtime.cursorCodec.encode({...context, position: {id: lastId}})
          )
        : undefined;
    const body = {
      count: items.length,
      _embedded: {documentTypes: items},
      _links: next ? {self: {href: self}, next: {href: next}} : {self: {href: self}}
    };
    const etag = this.etag.compute(body);
    if (ifNoneMatch && this.etag.matches(etag, ifNoneMatch)) return this.notModified(res);

    res.setHeader("ETag", etag);
    res.status(200).type("application/hal+json").json(body);
  }

  @Get("/:id")
  @OperationId("getDocumentType")
  @Summary("Consultar tipo de documento")
  @Description("Retorna representação ativa ou histórica.")
  @ContentType("application/hal+json")
  @(Returns(200, DocumentTypeResponse)
    .ContentType("application/hal+json")
    .Header("ETag", {$ref: "#/components/headers/ETag"} as never))
  @(Returns(304).Description("Representação inalterada."))
  @(Returns(400, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(404, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(429, ProblemDetails)
    .ContentType("application/problem+json")
    .Header("Retry-After", {$ref: "#/components/headers/RetryAfter"} as never))
  @(Returns(500, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(503, ProblemDetails).ContentType("application/problem+json"))
  async get(
    @PathParams("id") id: string,
    @HeaderParams("If-None-Match") ifNoneMatch: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    const traceId = getRequestTraceId(res.req!);
    if (!(await this.runtime.rateLimiter("getDocumentType", "read").handle(res.req!, res))) return;
    if (!isObjectId(id)) return this.writeProblem(res, invalidObjectIdFailure(), traceId);

    const result = await this.runtime.application.get.execute({id});
    if (result.isErr()) return this.writeProblem(res, result.error, traceId);

    const body = documentTypePresenter(result.value);
    const etag = this.etag.compute(body);
    if (ifNoneMatch && this.etag.matches(etag, ifNoneMatch)) return this.notModified(res);

    res.setHeader("ETag", etag);
    res.status(200).type("application/hal+json").json(body);
  }

  @Patch("/:id")
  @OperationId("updateDocumentType")
  @Summary("Alterar tipo de documento ativo")
  @ContentType("application/hal+json")
  @(Returns(200, DocumentTypeResponse)
    .ContentType("application/hal+json")
    .Header("ETag", {$ref: "#/components/headers/ETag"} as never))
  @(Returns(400, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(404, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(409, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(410, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(415, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(422, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(429, ProblemDetails)
    .ContentType("application/problem+json")
    .Header("Retry-After", {$ref: "#/components/headers/RetryAfter"} as never))
  @(Returns(500, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(503, ProblemDetails).ContentType("application/problem+json"))
  async update(
    @PathParams("id") id: string,
    @BodyParams({useValidation: false}) _dto: UpdateDocumentTypeDto,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const traceId = getRequestTraceId(res.req!);
    if (!(await this.runtime.rateLimiter("updateDocumentType", "write").handle(res.req!, res)))
      return;
    if (!isJsonRequest(res))
      return this.writeProblem(res, {code: "UNSUPPORTED_MEDIA_TYPE"}, traceId);
    if (!isObjectId(id)) return this.writeProblem(res, invalidObjectIdFailure(), traceId);
    const body = req.body as unknown;
    if (!isPatchBody(body)) return this.writeProblem(res, validationFailure(body), traceId);

    const result = await this.runtime.application.update.execute({
      id,
      patch: body as Record<string, unknown>
    });
    if (result.isErr()) {
      return this.writeProblem(res, withValidationField(result.error, body), traceId);
    }

    const representation = documentTypePresenter(result.value);
    res.setHeader("ETag", this.etag.compute(representation));
    res.status(200).type("application/hal+json").json(representation);
  }

  @Delete("/:id")
  @OperationId("deleteDocumentType")
  @Summary("Excluir tipo de documento")
  @(Returns(204).Description("Tipo excluído ou já excluído."))
  @(Returns(400, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(404, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(429, ProblemDetails)
    .ContentType("application/problem+json")
    .Header("Retry-After", {$ref: "#/components/headers/RetryAfter"} as never))
  @(Returns(500, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(503, ProblemDetails).ContentType("application/problem+json"))
  async remove(@PathParams("id") id: string, @Res() res: Response): Promise<void> {
    const traceId = getRequestTraceId(res.req!);
    if (!(await this.runtime.rateLimiter("deleteDocumentType", "write").handle(res.req!, res)))
      return;
    if (!isObjectId(id)) return this.writeProblem(res, invalidObjectIdFailure(), traceId);

    const result = await this.runtime.application.delete.execute({id});
    if (result.isErr()) return this.writeProblem(res, result.error, traceId);
    res.status(204).end();
  }

  private notModified(res: Response): void {
    res.status(304);
    res.removeHeader("Content-Type");
    res.removeHeader("Content-Length");
    res.end();
  }

  private writeProblem(res: Response, failure: HttpFailure | string, traceId: string): void {
    const normalized = typeof failure === "string" ? {code: failure} : failure;
    const {problem, retryAfter} = this.mapper.fromFailure(
      {...normalized, errors: normalized.errors ?? errorsFor(normalized.code, normalized)},
      {instance: res.req?.path ?? "/api/v1/document-types", traceId}
    );
    res.status(problem.status).type("application/problem+json");
    if (retryAfter) res.setHeader("Retry-After", String(retryAfter));
    res.json(problem);
  }
}

function isCreateBody(body: unknown): body is Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  const allowed = new Set(["name", "code", "description"]);
  return keys.includes("name") && keys.includes("code") && keys.every((key) => allowed.has(key));
}

function isPatchBody(body: unknown): body is Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  return keys.length > 0 && keys.every((key) => ["name", "code", "description"].includes(key));
}

function isJsonRequest(res: Response): boolean {
  return Boolean(res.req?.is("application/json"));
}

function isObjectId(value: string): boolean {
  return objectIdPattern.test(value);
}

function queryValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function listNextHref(query: URLSearchParams, cursor: string): string {
  const nextQuery = new URLSearchParams(query);
  nextQuery.set("cursor", cursor);
  return `/api/v1/document-types?${nextQuery.toString()}`;
}

function invalidObjectIdFailure(): HttpFailure {
  return {
    code: "INVALID_OBJECT_ID",
    errors: [
      fieldError("id", "INVALID_OBJECT_ID", "Informe um ObjectId hexadecimal com 24 caracteres.")
    ]
  };
}

function invalidQueryFailure(field: string): HttpFailure {
  return {
    code: "INVALID_QUERY_PARAMETER",
    errors: [
      fieldError(field, "INVALID_QUERY_PARAMETER", "Informe um parâmetro de consulta válido.")
    ]
  };
}

function validationFailure(body: unknown): HttpFailure {
  const field = inferInvalidField(body);
  return {
    code: "VALIDATION_ERROR",
    errors: [fieldError(field, "VALIDATION_ERROR", "Os dados informados são inválidos.")]
  };
}

function inferInvalidField(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "body";
  const record = body as Record<string, unknown>;
  const unexpected = Object.keys(record).find(
    (key) => !["name", "code", "description"].includes(key)
  );
  if (unexpected) return unexpected;
  if (Object.keys(record).length === 0) return "body";
  if (!("name" in record)) return "name";
  if (!("code" in record)) return "code";
  return "body";
}

function withValidationField(failure: HttpFailure, body: unknown): HttpFailure {
  if (failure.code !== "VALIDATION_ERROR" || failure.errors?.length) return failure;
  return {
    ...failure,
    errors: [
      fieldError(
        inferValidationField(body),
        "VALIDATION_ERROR",
        "Os dados informados são inválidos."
      )
    ]
  };
}

function inferValidationField(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "body";
  const record = body as Record<string, unknown>;
  if ("name" in record && !isValidName(record.name)) return "name";
  if ("code" in record && !isValidCode(record.code)) return "code";
  if ("description" in record && !isValidDescription(record.description)) return "description";
  return "body";
}

function isValidName(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.trim().replace(/\s+/g, " ").length >= 1 &&
    value.trim().replace(/\s+/g, " ").length <= 200
  );
}

function isValidCode(value: unknown): boolean {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(value);
}

function isValidDescription(value: unknown): boolean {
  return value === null || (typeof value === "string" && value.length <= 1000);
}

function errorsFor(code: string, failure: HttpFailure): readonly FieldError[] | undefined {
  if (failure.errors?.length) return failure.errors;
  if (code === "DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE") {
    return [fieldError("code", code, "O código já pertence a outro tipo de documento ativo.")];
  }
  if (code === "VALIDATION_ERROR")
    return [fieldError("body", code, "Os dados informados são inválidos.")];
  return undefined;
}

function fieldError(field: string, code: string, message: string): FieldError {
  return {field, code, message};
}

type ParsedDocumentTypeListQuery = {
  limit: number;
  cursor: string | undefined;
  filters: {name: string | undefined; code: string | undefined};
};

function parseDocumentTypeListQuery(
  rawLimit: string | undefined,
  rawCursor: string | undefined,
  name: string | undefined,
  code: string | undefined
): Result<ParsedDocumentTypeListQuery, HttpFailure> {
  const limit = rawLimit === undefined || rawLimit === "" ? 20 : Number(rawLimit);
  const cursor = rawCursor === undefined ? undefined : queryValue(rawCursor);
  const filters = {name: queryValue(name), code: queryValue(code)};

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return err(invalidQueryFailure("limit"));
  }
  if (rawCursor !== undefined && !cursor) {
    return err(invalidQueryFailure("cursor"));
  }

  return ok({limit, cursor, filters});
}

function resolveFilterFailure(
  filterError: HttpFailure & {kind: string; errors?: readonly FieldError[]},
  filters: {name: string | undefined; code: string | undefined}
): HttpFailure {
  if (filterError.kind === "application" && filterError.errors) {
    return {...filterError, errors: filterError.errors};
  }
  const field = filters.code !== undefined ? "code" : "name";
  return {...filterError, errors: invalidQueryFailure(field).errors};
}
