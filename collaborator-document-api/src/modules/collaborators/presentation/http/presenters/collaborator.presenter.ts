import type {CollaboratorOutput} from "../../../application/contracts/collaborator-output.js";

type HalLink = Readonly<{href: string; method?: "DELETE" | "PATCH" | "POST"}>;

export type CollaboratorHal = Readonly<{
  id: string;
  name: string;
  cpf: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  _links: Readonly<{
    self: HalLink;
    collection: HalLink;
    documents: HalLink;
    update?: HalLink;
    delete?: HalLink;
    "link-document"?: HalLink;
  }>;
}>;

type MutableCollaboratorLinks = {
  self: HalLink;
  collection: HalLink;
  documents: HalLink;
  update?: HalLink;
  delete?: HalLink;
  "link-document"?: HalLink;
};

/** Converte a saída primitiva da aplicação para a representação HAL publicada. */
export const collaboratorPresenter = (collaborator: CollaboratorOutput): CollaboratorHal => {
  const href = `/api/v1/collaborators/${collaborator.id}`;
  const links: MutableCollaboratorLinks = {
    self: {href},
    collection: {href: "/api/v1/collaborators"},
    documents: {href: `/api/v1/collaborator-documents?collaboratorId=${collaborator.id}`}
  };
  if (collaborator.deletedAt === null) {
    links.update = {href, method: "PATCH"};
    links.delete = {href, method: "DELETE"};
    links["link-document"] = {href: "/api/v1/collaborator-documents", method: "POST"};
  }

  return {
    id: collaborator.id,
    name: collaborator.name,
    cpf: collaborator.cpf,
    email: collaborator.email,
    createdAt: collaborator.createdAt,
    updatedAt: collaborator.updatedAt,
    deletedAt: collaborator.deletedAt,
    _links: links
  };
};
