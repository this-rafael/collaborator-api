export interface HalLink {
  href: string;
  templated?: boolean;
  method?: string;
  type?: string;
  title?: string;
}

export interface ApiRoot {
  name: string;
  version: string;
  _links: Record<string, HalLink>;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  traceId: string;
}

export const discoveryLinksFixture: Record<string, HalLink> = {
  self: {href: "/api/v1"},
  collaborators: {href: "/api/v1/collaborators{?cursor,limit,name,cpf,email}", templated: true},
  "document-types": {href: "/api/v1/document-types{?cursor,limit,name,code}", templated: true},
  "collaborator-documents": {
    href: "/api/v1/collaborator-documents{?cursor,limit,collaboratorId,documentTypeId,status,lifecycle}",
    templated: true
  },
  "pending-documents": {
    href: "/api/v1/pending-documents{?cursor,limit,collaboratorName,cpf,documentTypeName,documentTypeCode}",
    templated: true
  },
  completeness: {href: "/api/v1/statistics/completeness"},
  "pending-document-types": {href: "/api/v1/statistics/pending-document-types{?cursor,limit}", templated: true},
  "latest-submissions": {href: "/api/v1/submissions/latest{?cursor,limit}", templated: true},
  "submission-events": {href: "/api/v1/submission-events{?cursor,limit}", templated: true}
};

export const requiredDiscoveryRelations: readonly string[] = [
  "self",
  "collaborators",
  "document-types",
  "collaborator-documents",
  "pending-documents",
  "completeness",
  "pending-document-types",
  "latest-submissions",
  "submission-events"
] as const;

export const templatedDiscoveryRelations: readonly string[] = [
  "collaborators",
  "document-types",
  "collaborator-documents",
  "pending-documents",
  "pending-document-types",
  "latest-submissions",
  "submission-events"
] as const;

export const apiRootFixture: ApiRoot = {
  name: "Collaborator Document API",
  version: "1",
  _links: discoveryLinksFixture
};

export const apiRootAltVersionFixture: ApiRoot = {
  name: "Collaborator Document API",
  version: "2",
  _links: discoveryLinksFixture
};

export const problemDetailsFixture = (overrides: Partial<ProblemDetails> = {}): ProblemDetails => ({
  type: "https://api.example.com/problems/internal-server-error",
  title: "Falha interna ao processar a operação",
  status: 500,
  detail: "Ocorreu uma falha inesperada ao descobrir os recursos da API.",
  instance: "/api/v1",
  code: "INTERNAL_SERVER_ERROR",
  traceId: "01J3Y2QHB8FV4RGY7Y1QXNT2D4",
  ...overrides
});

export const problemDetailsRateLimitFixture = (overrides: Partial<ProblemDetails> = {}): ProblemDetails =>
  problemDetailsFixture({
    type: "https://api.example.com/problems/rate-limit-exceeded",
    title: "Limite de requisições excedido",
    status: 429,
    detail:
      "O limite de requisições para descobrir os recursos da API foi excedido. Aguarde antes de tentar novamente.",
    code: "RATE_LIMIT_EXCEEDED",
    ...overrides
  });

export const problemDetailsServiceUnavailableFixture = (
  overrides: Partial<ProblemDetails> = {}
): ProblemDetails =>
  problemDetailsFixture({
    type: "https://api.example.com/problems/service-unavailable",
    title: "Serviço temporariamente indisponível",
    status: 503,
    detail:
      "Não foi possível descobrir os recursos da API porque o MongoDB ou outra dependência necessária está indisponível.",
    code: "SERVICE_UNAVAILABLE",
    ...overrides
  });
