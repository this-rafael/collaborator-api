import {AdditionalProperties, Default, Property, Required} from "@tsed/schema";

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
}
