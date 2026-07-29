import {AdditionalProperties, Default, Property, Required} from "@tsed/schema";

@AdditionalProperties(false)
export class HalLink {
  @Required()
  @Property(String)
  href!: string;

  @Default(false)
  @Property(Boolean)
  templated?: boolean;
}
