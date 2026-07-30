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
  Post,
  Returns,
  Summary,
  Tags
} from "@tsed/schema";
import type {Request, Response} from "express";
import {err, ok, type Result} from "neverthrow";

import {normalizeCollaboratorDocumentFilters} from "../../../application/use-cases/list-collaborator-documents.use-case.js";
import {CollaboratorDocumentsRuntime} from "../../../collaborator-documents.runtime.js";
import type {FieldError} from "../../../../../shared/presentation/http/schemas/problem-details.js";
import {EtagService} from "../../../../../shared/presentation/http/cache/etag.service.js";
import {ProblemDetailsMapper} from "../../../../../shared/presentation/http/errors/problem-details.mapper.js";
import {getRequestTraceId} from "../../../../../shared/presentation/http/middlewares/request-id.middleware.js";
import {ProblemDetails} from "../../../../../shared/presentation/http/schemas/problem-details.js";
import {CreateCollaboratorDocumentDto} from "../dtos/create-collaborator-document.dto.js";
import {collaboratorDocumentPresenter} from "../presenters/collaborator-document.presenter.js";
import {
  CollaboratorDocumentCollectionResponse,
  CollaboratorDocumentResponse
} from "../schemas/collaborator-document-response.schema.js";

type HttpFailure = Readonly<{
  code: string;
  kind?: string;
  message?: string;
  errors?: readonly FieldError[];
}>;

const objectIdPattern = /^[a-f\d]{24}$/i;

/** Controlador REST para vínculos documentais. */
@Controller("/api/v1/collaborator-documents")
@Tags("Collaborator Documents")
export class CollaboratorDocumentsController {
  private readonly etag = new EtagService();
  private readonly mapper = new ProblemDetailsMapper();

  constructor(private readonly runtime: CollaboratorDocumentsRuntime) {}

  @Post("/")
  @OperationId("createCollaboratorDocument")
  @Summary("Criar vínculo documental")
  @Description(
    "Cria um novo ciclo em PENDING, versão 0. Também é usado para revinculação após encerramento de um ciclo anterior."
  )
  @ContentType("application/hal+json")
  @(Returns(201, CollaboratorDocumentResponse)
    .ContentType("application/hal+json")
    .Header("Location", {$ref: "#/components/headers/Location"} as never)
    .Header("ETag", {$ref: "#/components/headers/ETag"} as never)
    .Description("Vínculo documental criado."))
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
  async create(
    @BodyParams({useValidation: false}) _dto: CreateCollaboratorDocumentDto,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const traceId = getRequestTraceId(res.req!);
    if (
      !(await this.runtime.rateLimiter("createCollaboratorDocument", "write").handle(res.req!, res))
    )
      return;
    if (!isJsonRequest(res))
      return this.writeProblem(res, {code: "UNSUPPORTED_MEDIA_TYPE"}, traceId);
    const body = req.body as unknown;
    if (!isCreateBody(body)) return this.writeProblem(res, validationFailure(body), traceId);

    const result = await this.runtime.application.create.execute({
      collaboratorId: body.collaboratorId,
      documentTypeId: body.documentTypeId
    });
    if (result.isErr()) return this.writeProblem(res, result.error, traceId);

    const representation = collaboratorDocumentPresenter(result.value);
    const selfHref = representation._links.self!.href;
    res.setHeader("Location", selfHref);
    res.setHeader("ETag", this.etag.compute(representation));
    res.status(201).type("application/hal+json").json(representation);
  }

  @Get("/")
  @OperationId("listCollaboratorDocuments")
  @Summary("Listar vínculos documentais")
  @Description("Por padrão, retorna somente vínculos ativos: deletedAt=null e unlinkedAt=null.")
  @ContentType("application/hal+json")
  @(Returns(200, CollaboratorDocumentCollectionResponse)
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
    @QueryParams({expression: "collaboratorId", useType: String, useValidation: false})
    collaboratorId: string | undefined,
    @QueryParams({expression: "documentTypeId", useType: String, useValidation: false})
    documentTypeId: string | undefined,
    @QueryParams({expression: "status", useType: String, useValidation: false})
    status: string | undefined,
    @QueryParams({expression: "lifecycle", useType: String, useValidation: false})
    lifecycle: string | undefined,
    @QueryParams({expression: "limit", useType: String, useValidation: false})
    rawLimit: string | undefined,
    @QueryParams({expression: "cursor", useType: String, useValidation: false})
    rawCursor: string | undefined,
    @HeaderParams("If-None-Match") ifNoneMatch: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    const traceId = getRequestTraceId(res.req!);
    if (
      !(await this.runtime.rateLimiter("listCollaboratorDocuments", "read").handle(res.req!, res))
    )
      return;

    const parsed = parseListQuery(
      rawLimit,
      rawCursor,
      collaboratorId,
      documentTypeId,
      status,
      lifecycle
    );
    if (parsed.isErr()) return this.writeProblem(res, parsed.error, traceId);

    const {limit, cursor, filters} = parsed.value;
    const normalizedFilters = normalizeCollaboratorDocumentFilters(filters);
    if (normalizedFilters.isErr()) {
      return this.writeProblem(res, normalizedFilters.error, traceId);
    }

    const context = {
      operationId: "listCollaboratorDocuments",
      filtersHash: createHash("sha256")
        .update(JSON.stringify(normalizedFilters.value))
        .digest("hex"),
      order: "_id:asc",
      limit
    };
    const decoded = cursor ? this.runtime.cursorCodec.decode(cursor, context) : undefined;
    if (decoded?.isErr()) {
      return this.writeProblem(
        res,
        {
          code: "INVALID_QUERY_PARAMETER",
          errors: [
            {
              field: "cursor",
              code: "INVALID_CURSOR",
              message: "O cursor informado é inválido, expirado ou incompatível."
            }
          ]
        },
        traceId
      );
    }

    const result = await this.runtime.application.list.execute({
      filters: normalizedFilters.value,
      limit,
      afterId: decoded?.isOk() ? decoded.value.position.id : undefined
    });
    if (result.isErr()) return this.writeProblem(res, result.error, traceId);

    const items = result.value.items.map(collaboratorDocumentPresenter);
    const selfQuery = new URLSearchParams();
    for (const [key, value] of Object.entries(normalizedFilters.value)) {
      if (value !== undefined) selfQuery.set(key, String(value));
    }
    selfQuery.set("limit", String(limit));
    if (cursor) selfQuery.set("cursor", cursor);
    const self = `/api/v1/collaborator-documents?${selfQuery.toString()}`;
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
      _embedded: {"collaborator-documents": items},
      _links: next ? {self: {href: self}, next: {href: next}} : {self: {href: self}}
    };
    const etag = this.etag.compute(body);
    if (ifNoneMatch && this.etag.matches(etag, ifNoneMatch)) return this.notModified(res);

    res.setHeader("ETag", etag);
    res.status(200).type("application/hal+json").json(body);
  }

  @Get("/:id")
  @OperationId("getCollaboratorDocument")
  @Summary("Consultar vínculo documental")
  @Description("Retorna representação ativa ou histórica do vínculo.")
  @ContentType("application/hal+json")
  @(Returns(200, CollaboratorDocumentResponse)
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
    if (!(await this.runtime.rateLimiter("getCollaboratorDocument", "read").handle(res.req!, res)))
      return;
    if (!isObjectId(id)) return this.writeProblem(res, invalidObjectIdFailure(), traceId);

    const result = await this.runtime.application.get.execute({id});
    if (result.isErr()) return this.writeProblem(res, result.error, traceId);

    const body = collaboratorDocumentPresenter(result.value);
    const etag = this.etag.compute(body);
    if (ifNoneMatch && this.etag.matches(etag, ifNoneMatch)) return this.notModified(res);

    res.setHeader("ETag", etag);
    res.status(200).type("application/hal+json").json(body);
  }

  @Delete("/:id")
  @OperationId("unlinkCollaboratorDocument")
  @Summary("Desvincular vínculo documental")
  @Description("Encerra o ciclo ativo preenchendo unlinkedAt sem apagar histórico.")
  @(Returns(204).Description("Vínculo desvinculado."))
  @(Returns(400, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(404, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(410, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(429, ProblemDetails)
    .ContentType("application/problem+json")
    .Header("Retry-After", {$ref: "#/components/headers/RetryAfter"} as never))
  @(Returns(500, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(503, ProblemDetails).ContentType("application/problem+json"))
  async unlink(@PathParams("id") id: string, @Res() res: Response): Promise<void> {
    const traceId = getRequestTraceId(res.req!);
    if (
      !(await this.runtime.rateLimiter("unlinkCollaboratorDocument", "write").handle(res.req!, res))
    )
      return;
    if (!isObjectId(id)) return this.writeProblem(res, invalidObjectIdFailure(), traceId);

    const result = await this.runtime.application.unlink.execute({id});
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
      {...normalized, errors: normalized.errors ?? errorsFor(normalized.code)},
      {instance: res.req?.path ?? "/api/v1/collaborator-documents", traceId}
    );
    res.status(problem.status).type("application/problem+json");
    if (retryAfter) res.setHeader("Retry-After", String(retryAfter));
    res.json(problem);
  }
}

function isCreateBody(
  body: unknown
): body is Readonly<{collaboratorId: string; documentTypeId: string}> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 2) return false;
  if (!keys.includes("collaboratorId") || !keys.includes("documentTypeId")) return false;
  return (
    typeof record.collaboratorId === "string" &&
    objectIdPattern.test(record.collaboratorId) &&
    typeof record.documentTypeId === "string" &&
    objectIdPattern.test(record.documentTypeId)
  );
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
  return `/api/v1/collaborator-documents?${nextQuery.toString()}`;
}

function invalidObjectIdFailure(): HttpFailure {
  return {
    code: "INVALID_OBJECT_ID",
    errors: [
      {
        field: "id",
        code: "INVALID_OBJECT_ID",
        message: "Informe um ObjectId hexadecimal com 24 caracteres."
      }
    ]
  };
}

function invalidQueryFailure(field: string): HttpFailure {
  return {
    code: "INVALID_QUERY_PARAMETER",
    errors: [
      {
        field,
        code: "INVALID_QUERY_PARAMETER",
        message: "Informe um parâmetro de consulta válido."
      }
    ]
  };
}

function validationFailure(body: unknown): HttpFailure {
  const errors: FieldError[] = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      code: "VALIDATION_ERROR",
      errors: [{field: "body", code: "REQUIRED", message: "O corpo da requisição é obrigatório."}]
    };
  }
  const record = body as Record<string, unknown>;
  const allowed = new Set(["collaboratorId", "documentTypeId"]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      errors.push({
        field: key,
        code: "ADDITIONAL_PROPERTY",
        message: "Propriedade adicional não é permitida."
      });
    }
  }
  if (!Object.hasOwn(record, "collaboratorId")) {
    errors.push({
      field: "collaboratorId",
      code: "REQUIRED",
      message: "O identificador do colaborador é obrigatório."
    });
  } else if (
    typeof record.collaboratorId !== "string" ||
    !objectIdPattern.test(record.collaboratorId)
  ) {
    errors.push({
      field: "collaboratorId",
      code: "INVALID_OBJECT_ID",
      message: "Informe um ObjectId hexadecimal com 24 caracteres."
    });
  }
  if (!Object.hasOwn(record, "documentTypeId")) {
    errors.push({
      field: "documentTypeId",
      code: "REQUIRED",
      message: "O identificador do tipo de documento é obrigatório."
    });
  } else if (
    typeof record.documentTypeId !== "string" ||
    !objectIdPattern.test(record.documentTypeId)
  ) {
    errors.push({
      field: "documentTypeId",
      code: "INVALID_OBJECT_ID",
      message: "Informe um ObjectId hexadecimal com 24 caracteres."
    });
  }
  return {code: "VALIDATION_ERROR", errors};
}

function errorsFor(code: string): readonly FieldError[] | undefined {
  if (code === "ACTIVE_LINK_ALREADY_EXISTS") {
    return [
      {
        field: "documentTypeId",
        code: "DUPLICATE_ACTIVE_LINK",
        message: "Já existe um vínculo ativo para esta combinação de colaborador e tipo."
      }
    ];
  }
  if (code === "VALIDATION_ERROR") {
    return [{field: "body", code, message: "Os dados informados são inválidos."}];
  }
  return undefined;
}

type ParsedListQuery = {
  limit: number;
  cursor: string | undefined;
  filters: {
    collaboratorId: string | undefined;
    documentTypeId: string | undefined;
    status: string | undefined;
    lifecycle: string | undefined;
  };
};

function parseListQuery(
  rawLimit: string | undefined,
  rawCursor: string | undefined,
  collaboratorId: string | undefined,
  documentTypeId: string | undefined,
  status: string | undefined,
  lifecycle: string | undefined
): Result<ParsedListQuery, HttpFailure> {
  const limit = rawLimit === undefined || rawLimit === "" ? 20 : Number(rawLimit);
  const cursor = rawCursor === undefined ? undefined : queryValue(rawCursor);
  const filters = {
    collaboratorId: queryValue(collaboratorId),
    documentTypeId: queryValue(documentTypeId),
    status: queryValue(status),
    lifecycle: queryValue(lifecycle)
  };

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return err(invalidQueryFailure("limit"));
  }
  if (rawCursor !== undefined && !cursor) {
    return err(invalidQueryFailure("cursor"));
  }

  return ok({limit, cursor, filters});
}
