import type {ProblemDetails} from "../schemas/problem-details.js";

type FailureLike = Readonly<{
  code?: string;
  message?: string;
  kind?: string;
}>;

const KNOWN_CODES: Record<string, {status: number; type: string; title: string; detail: string}> = {
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
  }
};

const DEFAULT_PROBLEM = {
  status: 500,
  type: "https://api.example.com/problems/internal-server-error",
  title: "Falha interna ao processar a operação",
  detail: "Ocorreu uma falha inesperada ao descobrir os recursos da API."
};

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
