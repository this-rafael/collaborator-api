import type {FieldError, ProblemDetails} from "../schemas/problem-details.js";

type FailureLike = Readonly<{
  code?: string;
  message?: string;
  kind?: string;
  errors?: readonly FieldError[];
}>;

const KNOWN_CODES: Record<string, {status: number; type: string; title: string; detail: string}> = {
  MALFORMED_JSON: {
    status: 400,
    type: "https://api.example.com/problems/malformed-json",
    title: "Corpo JSON malformado",
    detail: "Não foi possível interpretar o corpo JSON enviado."
  },
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
  INVALID_VERSION_NUMBER: {
    status: 400,
    type: "https://api.example.com/problems/invalid-version-number",
    title: "Número de versão inválido",
    detail: "O número de versão informado é inválido."
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
  },
  DOCUMENT_TYPE_NOT_FOUND: {
    status: 404,
    type: "https://api.example.com/problems/document-type-not-found",
    title: "Tipo de documento não encontrado",
    detail: "Não existe tipo de documento para o identificador informado."
  },
  DOCUMENT_TYPE_DELETED: {
    status: 410,
    type: "https://api.example.com/problems/document-type-deleted",
    title: "Tipo de documento excluído",
    detail: "O tipo de documento excluído não pode ser alterado."
  },
  DUPLICATE_ACTIVE_DOCUMENT_TYPE_CODE: {
    status: 409,
    type: "https://api.example.com/problems/duplicate-active-document-type-code",
    title: "Código de tipo de documento já utilizado",
    detail: "Já existe um tipo de documento ativo com o código informado."
  },
  COLLABORATOR_DOCUMENT_NOT_FOUND: {
    status: 404,
    type: "https://api.example.com/problems/collaborator-document-not-found",
    title: "Vínculo documental não encontrado",
    detail: "Não existe vínculo documental para o identificador informado."
  },
  ACTIVE_LINK_ALREADY_EXISTS: {
    status: 409,
    type: "https://api.example.com/problems/active-link-already-exists",
    title: "Vínculo documental ativo já existe",
    detail: "Já existe um vínculo ativo para o colaborador e tipo de documento informados."
  },
  COLLABORATOR_DOCUMENT_UNLINKED: {
    status: 410,
    type: "https://api.example.com/problems/collaborator-document-unlinked",
    title: "Vínculo documental desvinculado",
    detail: "O vínculo documental já foi desvinculado."
  },
  COLLABORATOR_DOCUMENT_DELETED: {
    status: 410,
    type: "https://api.example.com/problems/collaborator-document-deleted",
    title: "Vínculo documental excluído",
    detail: "O vínculo documental foi removido por cascata."
  },
  INVALID_DOCUMENT_STATE: {
    status: 422,
    type: "https://api.example.com/problems/invalid-document-state",
    title: "Estado documental inválido",
    detail: "A operação não é permitida no estado atual do vínculo documental."
  },
  DOCUMENT_VERSION_NOT_FOUND: {
    status: 404,
    type: "https://api.example.com/problems/document-version-not-found",
    title: "Versão de documento não encontrada",
    detail: "Não existe versão de documento para o identificador informado."
  },
  DOCUMENT_HISTORY_LIMIT_REACHED: {
    status: 422,
    type: "https://api.example.com/problems/document-history-limit-reached",
    title: "Limite de histórico documental atingido",
    detail: "Não foi possível armazenar outra versão sem comprometer o histórico existente."
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
  /**
   * Converte uma falha em um documento Problem Details com o status HTTP e os
   * metadados adequados.
   *
   * @param failure - Falha de domínio/aplicação (com `code`, `message` e,
   *   opcionalmente, `errors` de campo).
   * @param ctx - Contexto da resposta: `instance` (caminho da requisição) e
   *   `traceId` para correlação.
   * @returns Objeto com o `problem` (ProblemDetails) e, quando aplicável,
   *   `retryAfter` (segundos) para o código RATE_LIMIT_EXCEEDED. Códigos
   *   desconhecidos são mapeados para HTTP 500 (INTERNAL_SERVER_ERROR).
   */
  fromFailure(
    failure: FailureLike,
    ctx: {instance: string; traceId: string}
  ): {problem: ProblemDetails; retryAfter?: number} {
    const rawCode = failure.code ?? "INTERNAL_SERVER_ERROR";
    const known = KNOWN_CODES[rawCode];
    const code = known ? rawCode : "INTERNAL_SERVER_ERROR";
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
    if (failure.errors?.length) problem.errors = [...failure.errors];

    const retryAfter = code === "RATE_LIMIT_EXCEEDED" ? 1 : undefined;
    return {problem, retryAfter};
  }
}
