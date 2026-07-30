import {AdditionalProperties, Default, Enum, Property, Required} from "@tsed/schema";

/**
 * Schema de um link HAL conforme RFC 5988.
 */
@AdditionalProperties(false)
export class HalLink {
  @Required()
  @Property(String)
  href!: string;

  @Default(false)
  @Property(Boolean)
  templated?: boolean;

  @Enum("GET", "POST", "PATCH", "DELETE")
  @Property(String)
  method?: string;

  @Property(String)
  type?: string;

  @Property(String)
  title?: string;
}
