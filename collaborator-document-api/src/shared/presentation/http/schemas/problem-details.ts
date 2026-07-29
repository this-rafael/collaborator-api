import {
  AdditionalProperties,
  Enum,
  Format,
  Integer,
  Maximum,
  Minimum,
  Property,
  Required
} from "@tsed/schema";

@AdditionalProperties(false)
export class ProblemDetails {
  [key: string]: unknown;

  @Required()
  @Format("uri")
  @Property(String)
  type!: string;

  @Required()
  @Property(String)
  title!: string;

  @Required()
  @Integer()
  @Minimum(400)
  @Maximum(599)
  @Property(Number)
  status!: number;

  @Required()
  @Property(String)
  detail!: string;

  @Required()
  @Property(String)
  instance!: string;

  @Required()
  @Enum("RATE_LIMIT_EXCEEDED", "INTERNAL_SERVER_ERROR", "SERVICE_UNAVAILABLE")
  @Property(String)
  code!: string;

  @Required()
  @Property(String)
  traceId!: string;
}
