import type {DocumentVersionOutput} from "../../../application/contracts/document-version-output.js";

type HalLink = Readonly<{href: string}>;

/** Representação HAL de uma versão documental. */
export type DocumentVersionHal = DocumentVersionOutput &
  Readonly<{_links: Readonly<Record<string, HalLink>>}>;

/** Converte a saída primitiva da aplicação para a representação da versão. */
export const documentVersionPresenter = (
  documentId: string,
  version: DocumentVersionOutput
): DocumentVersionHal => {
  const documentHref = `/api/v1/collaborator-documents/${documentId}`;
  const links: Record<string, HalLink> = {
    self: {href: `${documentHref}/versions/${version.version}`},
    document: {href: documentHref}
  };
  if (version.version > 1) {
    links.previous = {href: `${documentHref}/versions/${version.version - 1}`};
  }
  return {...version, _links: links};
};
