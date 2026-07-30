import type {DocumentTypeOutput} from "../../../application/contracts/document-type-output.js";

type HalLink = Readonly<{href: string; method?: "DELETE" | "PATCH"}>;

export type DocumentTypeHal = Readonly<{
  id: string;
  name: string;
  code: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  _links: Readonly<{
    self: HalLink;
    collection: HalLink;
    update?: HalLink;
    delete?: HalLink;
  }>;
}>;

type MutableLinks = {
  self: HalLink;
  collection: HalLink;
  update?: HalLink;
  delete?: HalLink;
};

export const documentTypePresenter = (documentType: DocumentTypeOutput): DocumentTypeHal => {
  const href = `/api/v1/document-types/${documentType.id}`;
  const links: MutableLinks = {
    self: {href},
    collection: {href: "/api/v1/document-types"}
  };
  if (documentType.deletedAt === null) {
    links.update = {href, method: "PATCH"};
    links.delete = {href, method: "DELETE"};
  }

  return {
    id: documentType.id,
    name: documentType.name,
    code: documentType.code,
    description: documentType.description,
    createdAt: documentType.createdAt,
    updatedAt: documentType.updatedAt,
    deletedAt: documentType.deletedAt,
    _links: links
  };
};
