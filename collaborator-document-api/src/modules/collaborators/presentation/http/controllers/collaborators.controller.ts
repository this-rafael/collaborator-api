import {createHash} from "node:crypto";

import {Controller} from "@tsed/di";
import {BodyParams, HeaderParams, PathParams, QueryParams} from "@tsed/platform-params";
import {Res} from "@tsed/platform-http";
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
import type {Response} from "express";
import {err, ok, type Result} from "neverthrow";

import {normalizeCollaboratorFilters} from "../../../application/use-cases/list-collaborators.use-case.js";
import {CollaboratorsRuntime} from "../../../collaborators.runtime.js";
import type {FieldError} from "../../../../../shared/presentation/http/schemas/problem-details.js";
import {EtagService} from "../../../../../shared/presentation/http/cache/etag.service.js";
import {ProblemDetailsMapper} from "../../../../../shared/presentation/http/errors/problem-details.mapper.js";
import {getRequestTraceId} from "../../../../../shared/presentation/http/middlewares/request-id.middleware.js";
import {ProblemDetails} from "../../../../../shared/presentation/http/schemas/problem-details.js";
import {CreateCollaboratorDto} from "../dtos/create-collaborator.dto.js";
import {UpdateCollaboratorDto} from "../dtos/update-collaborator.dto.js";
import {collaboratorPresenter} from "../presenters/collaborator.presenter.js";
import {
  CollaboratorCollectionResponse,
  CollaboratorResponse
} from "../schemas/collaborator-response.schema.js";

type HttpFailure = Readonly<{
  code: string;
  kind?: string;
  message?: string;
  errors?: readonly FieldError[];
}>;

const objectIdPattern = /^[a-f\d]{24}$/i;

/** Expõe o CRUD de colaboradores como uma fronteira HTTP fina. */
@Controller("/api/v1/collaborators")
@Tags("Collaborators")
export class CollaboratorsController {
  private readonly etag = new EtagService();
  private readonly mapper = new ProblemDetailsMapper();

  constructor(private readonly runtime: CollaboratorsRuntime) {}

  @Post("/")
  @OperationId("createCollaborator")
  @Summary("Criar colaborador")
  @Description("Cria um colaborador ativo.")
  @ContentType("application/hal+json")
  @(Returns(201, CollaboratorResponse)
    .ContentType("application/hal+json")
    .Header("Location", {$ref: "#/components/headers/Location"} as never)
    .Header("ETag", {$ref: "#/components/headers/ETag"} as never)
    .Description("Colaborador criado."))
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
    @BodyParams({useValidation: false}) body: CreateCollaboratorDto,
    @Res() res: Response
  ): Promise<void> {
    const traceId = getRequestTraceId(res.req!);
    if (!(await this.runtime.rateLimiter("createCollaborator", "write").handle(res.req!, res)))
      return;
    if (!isJsonRequest(res))
      return this.writeProblem(res, {code: "UNSUPPORTED_MEDIA_TYPE"}, traceId);
    if (!isCreateBody(body)) return this.writeProblem(res, validationFailure("body"), traceId);

    const result = await this.runtime.application.create.execute(body);
    if (result.isErr()) return this.writeProblem(res, result.error, traceId);

    const representation = collaboratorPresenter(result.value);
    res.setHeader("Location", representation._links.self.href);
    res.setHeader("ETag", this.etag.compute(representation));
    res.status(201).type("application/hal+json").json(representation);
  }

  @Get("/")
  @OperationId("listCollaborators")
  @Summary("Listar colaboradores ativos")
  @Description("Lista colaboradores ativos por paginação keyset; filtros são combinados por AND.")
  @ContentType("application/hal+json")
  @(Returns(200, CollaboratorCollectionResponse)
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
    @QueryParams({expression: "cpf", useType: String, useValidation: false})
    cpf: string | undefined,
    @QueryParams({expression: "email", useType: String, useValidation: false})
    email: string | undefined,
    @QueryParams({expression: "limit", useType: String, useValidation: false})
    rawLimit: string | undefined,
    @QueryParams({expression: "cursor", useType: String, useValidation: false})
    rawCursor: string | undefined,
    @HeaderParams("If-None-Match") ifNoneMatch: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    const traceId = getRequestTraceId(res.req!);
    if (!(await this.runtime.rateLimiter("listCollaborators", "read").handle(res.req!, res)))
      return;

    const parsed = parseCollaboratorListQuery(rawLimit, rawCursor, name, cpf, email);
    if (parsed.isErr()) return this.writeProblem(res, parsed.error, traceId);

    const {limit, cursor, filters} = parsed.value;
    const normalizedFilters = normalizeCollaboratorFilters(filters);
    if (normalizedFilters.isErr()) {
      const field = filters.cpf !== undefined ? "cpf" : "email";
      return this.writeProblem(res, invalidQueryFailure(field), traceId);
    }

    const context = {
      operationId: "listCollaborators",
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

    const items = result.value.items.map(collaboratorPresenter);
    const selfQuery = new URLSearchParams();
    for (const [key, value] of Object.entries(normalizedFilters.value)) {
      if (value) selfQuery.set(key, value);
    }
    selfQuery.set("limit", String(limit));
    if (cursor) selfQuery.set("cursor", cursor);
    const self = `/api/v1/collaborators?${selfQuery.toString()}`;
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
      _embedded: {collaborators: items},
      _links: next ? {self: {href: self}, next: {href: next}} : {self: {href: self}}
    };
    const etag = this.etag.compute(body);
    if (ifNoneMatch && this.etag.matches(etag, ifNoneMatch)) return this.notModified(res);

    res.setHeader("ETag", etag);
    res.status(200).type("application/hal+json").json(body);
  }

  @Get("/:id")
  @OperationId("getCollaborator")
  @Summary("Consultar colaborador")
  @Description("Retorna representação ativa ou histórica.")
  @ContentType("application/hal+json")
  @(Returns(200, CollaboratorResponse)
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
    if (!(await this.runtime.rateLimiter("getCollaborator", "read").handle(res.req!, res))) return;
    if (!isObjectId(id)) return this.writeProblem(res, invalidObjectIdFailure(), traceId);

    const result = await this.runtime.application.get.execute({id});
    if (result.isErr()) return this.writeProblem(res, result.error, traceId);

    const body = collaboratorPresenter(result.value);
    const etag = this.etag.compute(body);
    if (ifNoneMatch && this.etag.matches(etag, ifNoneMatch)) return this.notModified(res);

    res.setHeader("ETag", etag);
    res.status(200).type("application/hal+json").json(body);
  }

  @Patch("/:id")
  @OperationId("updateCollaborator")
  @Summary("Alterar colaborador ativo")
  @ContentType("application/hal+json")
  @(Returns(200, CollaboratorResponse)
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
    @BodyParams({useValidation: false}) body: UpdateCollaboratorDto,
    @Res() res: Response
  ): Promise<void> {
    const traceId = getRequestTraceId(res.req!);
    if (!(await this.runtime.rateLimiter("updateCollaborator", "write").handle(res.req!, res)))
      return;
    if (!isJsonRequest(res))
      return this.writeProblem(res, {code: "UNSUPPORTED_MEDIA_TYPE"}, traceId);
    if (!isObjectId(id)) return this.writeProblem(res, invalidObjectIdFailure(), traceId);
    if (!isPatchBody(body)) return this.writeProblem(res, validationFailure("body"), traceId);

    const result = await this.runtime.application.update.execute({id, patch: body});
    if (result.isErr()) return this.writeProblem(res, result.error, traceId);

    const representation = collaboratorPresenter(result.value);
    res.setHeader("ETag", this.etag.compute(representation));
    res.status(200).type("application/hal+json").json(representation);
  }

  @Delete("/:id")
  @OperationId("deleteCollaborator")
  @Summary("Excluir colaborador")
  @(Returns(204).Description("Colaborador excluído ou já excluído."))
  @(Returns(400, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(404, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(429, ProblemDetails)
    .ContentType("application/problem+json")
    .Header("Retry-After", {$ref: "#/components/headers/RetryAfter"} as never))
  @(Returns(500, ProblemDetails).ContentType("application/problem+json"))
  @(Returns(503, ProblemDetails).ContentType("application/problem+json"))
  async remove(@PathParams("id") id: string, @Res() res: Response): Promise<void> {
    const traceId = getRequestTraceId(res.req!);
    if (!(await this.runtime.rateLimiter("deleteCollaborator", "write").handle(res.req!, res)))
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
      {...normalized, errors: normalized.errors ?? errorsFor(normalized.code)},
      {instance: res.req?.path ?? "/api/v1/collaborators", traceId}
    );
    res.status(problem.status).type("application/problem+json");
    if (retryAfter) res.setHeader("Retry-After", String(retryAfter));
    res.json(problem);
  }
}

function isCreateBody(body: unknown): body is Record<"name" | "cpf" | "email", unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  return keys.length === 3 && keys.every((key) => ["name", "cpf", "email"].includes(key));
}

function isPatchBody(body: unknown): body is Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  return keys.length > 0 && keys.every((key) => ["name", "cpf", "email"].includes(key));
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
  return `/api/v1/collaborators?${nextQuery.toString()}`;
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

function validationFailure(field: string): HttpFailure {
  return {
    code: "VALIDATION_ERROR",
    errors: [fieldError(field, "VALIDATION_ERROR", "Os dados informados são inválidos.")]
  };
}

function errorsFor(code: string): readonly FieldError[] | undefined {
  if (code === "DUPLICATE_ACTIVE_CPF") {
    return [fieldError("cpf", code, "O CPF já pertence a outro colaborador ativo.")];
  }
  if (code === "DUPLICATE_ACTIVE_EMAIL") {
    return [fieldError("email", code, "O e-mail já pertence a outro colaborador ativo.")];
  }
  if (code === "VALIDATION_ERROR")
    return [fieldError("body", code, "Os dados informados são inválidos.")];
  return undefined;
}

function fieldError(field: string, code: string, message: string): FieldError {
  return {field, code, message};
}

type ParsedCollaboratorListQuery = {
  limit: number;
  cursor: string | undefined;
  filters: {name: string | undefined; cpf: string | undefined; email: string | undefined};
};

function parseCollaboratorListQuery(
  rawLimit: string | undefined,
  rawCursor: string | undefined,
  name: string | undefined,
  cpf: string | undefined,
  email: string | undefined
): Result<ParsedCollaboratorListQuery, HttpFailure> {
  const limit = rawLimit === undefined || rawLimit === "" ? 20 : Number(rawLimit);
  const cursor = rawCursor === undefined ? undefined : queryValue(rawCursor);
  const filters = {name: queryValue(name), cpf: queryValue(cpf), email: queryValue(email)};

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return err(invalidQueryFailure("limit"));
  }
  if (rawCursor !== undefined && !cursor) {
    return err(invalidQueryFailure("cursor"));
  }

  return ok({limit, cursor, filters});
}
