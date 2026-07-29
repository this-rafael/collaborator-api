import {AdditionalProperties, Property, Required} from "@tsed/schema";

import {HalLink} from "./hal-link.js";

@AdditionalProperties(false)
export class ApiRoot {
  @Required()
  @Property(String)
  name!: string;

  @Required()
  @Property(String)
  version!: string;

  @Required()
  @Property(Object)
  @AdditionalProperties({$ref: "#/components/schemas/HalLink"})
  _links!: Record<string, HalLink>;
}
