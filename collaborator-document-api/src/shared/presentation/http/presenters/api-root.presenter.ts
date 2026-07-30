import type {ApiRoot} from "../schemas/api-root.js";
import type {HalLink} from "../schemas/hal-link.js";

const discoveryLinks: Record<string, HalLink> = {
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
  "pending-document-types": {
    href: "/api/v1/statistics/pending-document-types{?cursor,limit}",
    templated: true
  },
  "latest-submissions": {href: "/api/v1/submissions/latest{?cursor,limit}", templated: true},
  "submission-events": {href: "/api/v1/submission-events{?cursor,limit}", templated: true}
};

/**
 * Apresenta o resultado do discovery no formato
 * HAL+JSON, populando os `_links` com todos os recursos
 * disponíveis da API.
 *
 * @param root - Dados base do discovery (nome, versão).
 * @returns Objeto ApiRoot com `_links` populados.
 */
export function apiRootPresenter(root: ApiRoot): ApiRoot {
  return {
    name: root.name,
    version: root.version,
    _links: {...discoveryLinks}
  };
}
