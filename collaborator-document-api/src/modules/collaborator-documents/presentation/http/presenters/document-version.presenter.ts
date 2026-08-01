import type {
  DocumentVersionListPage,
  DocumentVersionOutput
} from "../../../application/contracts/document-version-output.js";

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

/** Representação HAL de uma página do histórico de versões. */
export type DocumentVersionCollectionHal = Readonly<{
  count: number;
  currentVersion: number;
  _embedded: Readonly<{versions: readonly DocumentVersionHal[]}>;
  _links: Readonly<Record<string, HalLink>>;
}>;

/** Converte uma página da aplicação para a coleção HAL publicada. */
export const documentVersionCollectionPresenter = (
  documentId: string,
  page: DocumentVersionListPage,
  hrefs: Readonly<{self: string; next?: string}>
): DocumentVersionCollectionHal => ({
  count: page.items.length,
  currentVersion: page.currentVersion,
  _embedded: {versions: page.items.map((version) => documentVersionPresenter(documentId, version))},
  _links: hrefs.next
    ? {self: {href: hrefs.self}, next: {href: hrefs.next}}
    : {self: {href: hrefs.self}}
});
