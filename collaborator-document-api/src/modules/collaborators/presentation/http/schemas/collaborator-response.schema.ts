import {
  AdditionalProperties,
  CollectionOf,
  Format,
  Integer,
  Minimum,
  Name,
  Nullable,
  Pattern,
  Property,
  Required
} from "@tsed/schema";

import {HalLink} from "../../../../../shared/presentation/http/schemas/hal-link.js";

/** Relações HAL disponíveis para uma representação de colaborador. */
@AdditionalProperties({$ref: "#/components/schemas/HalLink"})
@Name("HalLinks")
export class CollaboratorHalLinks {
  [relation: string]: HalLink;
}

/** Relações de uma coleção paginada. */
@AdditionalProperties({$ref: "#/components/schemas/HalLink"})
@Name("PageLinks")
export class CollaboratorPageLinks {
  @Required()
  @Property(HalLink)
  self!: HalLink;

  @Property(HalLink)
  next?: HalLink;
}

/** Representação HAL publicada de um colaborador. */
@AdditionalProperties(false)
@Name("Collaborator")
export class CollaboratorResponse {
  @Required()
  @Property(String)
  @Pattern(/^[a-f\d]{24}$/i)
  id!: string;

  @Required()
  @Property(String)
  name!: string;

  @Required()
  @Property(String)
  @Pattern(/^\d{11}$/)
  cpf!: string;

  @Required()
  @Property(String)
  @Format("email")
  email!: string;

  @Required()
  @Property(String)
  @Format("date-time")
  createdAt!: string;

  @Required()
  @Property(String)
  @Format("date-time")
  updatedAt!: string;

  @Required()
  @Nullable(String)
  @Format("date-time")
  deletedAt!: string | null;

  @Required()
  @Property(CollaboratorHalLinks)
  _links!: CollaboratorHalLinks;
}

/** Embedding da coleção de colaboradores. */
@AdditionalProperties(false)
export class CollaboratorCollectionEmbedded {
  @Required()
  @CollectionOf(CollaboratorResponse)
  collaborators!: CollaboratorResponse[];
}

/** Página HAL publicada pela listagem de colaboradores. */
@AdditionalProperties(false)
@Name("CollaboratorCollection")
export class CollaboratorCollectionResponse {
  @Required()
  @Integer()
  @Minimum(0)
  @Property(Number)
  count!: number;

  @Required()
  @Property(CollaboratorCollectionEmbedded)
  _embedded!: CollaboratorCollectionEmbedded;

  @Required()
  @Property(CollaboratorPageLinks)
  _links!: CollaboratorPageLinks;
}
