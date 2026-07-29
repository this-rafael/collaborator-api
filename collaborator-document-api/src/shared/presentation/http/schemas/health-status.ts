import {AdditionalProperties, Enum, Property, Required} from "@tsed/schema";

@AdditionalProperties(false)
export class HealthStatus {
  @Required()
  @Enum("ok")
  @Property(String)
  status!: string;
}
