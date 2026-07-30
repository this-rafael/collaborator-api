import {CollectionOf, Integer, Minimum, Name, Nullable, Property, Required} from "@tsed/schema";

class HalLinkSchema {
  @Required()
  @Property(String)
  href!: string;

  @Property(String)
  method?: string;
}

class CollaboratorDocumentHalLinks {
  @Required()
  @Property(HalLinkSchema)
  self!: HalLinkSchema;
}

/** Schema OpenAPI da representação HAL de vínculo. */
@Name("CollaboratorDocument")
export class CollaboratorDocumentResponse {
  @Required()
  @Property(String)
  id!: string;

  @Required()
  @Property(String)
  collaboratorId!: string;

  @Required()
  @Property(String)
  documentTypeId!: string;

  @Required()
  @Property(String)
  status!: string;

  @Required()
  @Integer()
  @Minimum(0)
  currentVersion!: number;

  @Required()
  @Nullable(String)
  @Property(String)
  lastSubmittedAt!: string | null;

  @Required()
  @Property(String)
  linkedAt!: string;

  @Required()
  @Nullable(String)
  @Property(String)
  unlinkedAt!: string | null;

  @Required()
  @Property(String)
  createdAt!: string;

  @Required()
  @Property(String)
  updatedAt!: string;

  @Required()
  @Nullable(String)
  @Property(String)
  deletedAt!: string | null;

  @Required()
  @Property(CollaboratorDocumentHalLinks)
  _links!: CollaboratorDocumentHalLinks;
}

class CollaboratorDocumentCollectionEmbedded {
  @Required()
  @CollectionOf(CollaboratorDocumentResponse)
  "collaborator-documents"!: CollaboratorDocumentResponse[];
}

class CollaboratorDocumentCollectionLinks {
  @Required()
  @Property(HalLinkSchema)
  self!: HalLinkSchema;

  @Property(HalLinkSchema)
  next?: HalLinkSchema;
}

/** Schema OpenAPI da coleção HAL de vínculos. */
@Name("CollaboratorDocumentCollection")
export class CollaboratorDocumentCollectionResponse {
  @Required()
  @Integer()
  @Minimum(0)
  count!: number;

  @Required()
  @Property(CollaboratorDocumentCollectionEmbedded)
  _embedded!: CollaboratorDocumentCollectionEmbedded;

  @Required()
  @Property(CollaboratorDocumentCollectionLinks)
  _links!: CollaboratorDocumentCollectionLinks;
}
