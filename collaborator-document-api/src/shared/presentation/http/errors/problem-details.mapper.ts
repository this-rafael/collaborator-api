import type {ProblemDetails} from "../schemas/problem-details.js";

type FailureLike = Readonly<{
  code?: string;
  message?: string;
  kind?: string;
}>;

const KNOWN_CODES: Record<string, {status: number; type: string; title: string; detail: string}> = {
  INVALID_QUERY_PARAMETER: {
    status: 400,
    type: "https://api.example.com/problems/invalid-query-parameter",
    title: "Parâmetro de consulta inválido",
    detail: "Um ou mais parâmetros da requisição são inválidos."
  },
  INVALID_OBJECT_ID: {
    status: 400,
    type: "https://api.example.com/problems/invalid-object-id",
    title: "Identificador inválido",
    detail: "O identificador informado é inválido."
  },
  RATE_LIMIT_EXCEEDED: {
    status: 429,
    type: "https://api.example.com/problems/rate-limit-exceeded",
    title: "Limite de requisições excedido",
    detail:
      "O limite de requisições para descobrir os recursos da API foi excedido. Aguarde antes de tentar novamente."
  },
  SERVICE_UNAVAILABLE: {
    status: 503,
    type: "https://api.example.com/problems/service-unavailable",
    title: "Serviço temporariamente indisponível",
    detail:
      "Não foi possível descobrir os recursos da API porque o MongoDB ou outra dependência necessária está indisponível."
  },
  VALIDATION_ERROR: {
    status: 422,
    type: "https://api.example.com/problems/validation-error",
    title: "Dados da requisição inválidos",
    detail: "Os dados informados não atendem aos requisitos da operação."
  },
  UNSUPPORTED_MEDIA_TYPE: {
    status: 415,
    type: "https://api.example.com/problems/unsupported-media-type",
    title: "Tipo de mídia não suportado",
    detail: "A operação exige conteúdo application/json."
  },
  COLLABORATOR_NOT_FOUND: {
    status: 404,
    type: "https://api.example.com/problems/collaborator-not-found",
    title: "Colaborador não encontrado",
    detail: "Não existe colaborador para o identificador informado."
  },
  COLLABORATOR_DELETED: {
    status: 410,
    type: "https://api.example.com/problems/collaborator-deleted",
    title: "Colaborador excluído",
    detail: "O colaborador excluído não pode ser alterado."
  },
  DUPLICATE_ACTIVE_CPF: {
    status: 409,
    type: "https://api.example.com/problems/duplicate-active-cpf",
    title: "CPF já utilizado por um colaborador ativo",
    detail: "Já existe um colaborador ativo com o CPF informado."
  },
  DUPLICATE_ACTIVE_EMAIL: {
    status: 409,
    type: "https://api.example.com/problems/duplicate-active-email",
    title: "E-mail já utilizado por um colaborador ativo",
    detail: "Já existe um colaborador ativo com o e-mail informado."
  }
};

const DEFAULT_PROBLEM = {
  status: 500,
  type: "https://api.example.com/problems/internal-server-error",
  title: "Falha interna ao processar a operação",
  detail: "Ocorreu uma falha inesperada ao descobrir os recursos da API."
};

/**
 * Mapeia falhas da aplicação/domínio para respostas HTTP
 * padronizadas no formato Problem Details (RFC 9457).
 *
 * Conhece os códigos de erro da aplicação e seus
 * respectivos status HTTP, tipo URI, título e detalhe.
 * Falhas desconhecidas são mapeadas para 500.
 */
export class ProblemDetailsMapper {
  fromFailure(
    failure: FailureLike,
    ctx: {instance: string; traceId: string}
  ): {problem: ProblemDetails; retryAfter?: number} {
    const rawCode = failure.code ?? "INTERNAL_SERVER_ERROR";
    const known = KNOWN_CODES[rawCode];
    const isDomain = failure.kind === "domain";
    const code = known ? rawCode : isDomain ? rawCode : "INTERNAL_SERVER_ERROR";
    const resolved = known ?? DEFAULT_PROBLEM;

    const problem: ProblemDetails = {
      type: resolved.type,
      title: resolved.title,
      status: resolved.status,
      detail: resolved.detail,
      instance: ctx.instance,
      code,
      traceId: ctx.traceId
    };

    const retryAfter = code === "RATE_LIMIT_EXCEEDED" ? 1 : undefined;
    return {problem, retryAfter};
  }
}
