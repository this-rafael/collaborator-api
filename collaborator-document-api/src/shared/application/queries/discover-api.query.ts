import {err, ok, type Result} from "neverthrow";

import type {ApiRoot} from "../../presentation/http/schemas/api-root.js";
import {ApplicationFailure} from "../application-failure.js";
import type {DiscoveryAvailability} from "../ports/discovery-availability.js";

const discoveryLinks = {
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

export class DiscoverApiQuery {
  constructor(private readonly availability: DiscoveryAvailability) {}

  async execute(): Promise<Result<ApiRoot, ApplicationFailure>> {
    const available = await this.availability.isAvailable();
    if (!available) {
      return err(new ApplicationFailure("SERVICE_UNAVAILABLE", "MongoDB indisponível"));
    }

    const root: ApiRoot = {
      name: "Collaborator Document API",
      version: "1",
      _links: {...discoveryLinks}
    };

    return ok(root);
  }
}
