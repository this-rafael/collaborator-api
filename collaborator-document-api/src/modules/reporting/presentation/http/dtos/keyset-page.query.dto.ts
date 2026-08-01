import {Default, Integer, Maximum, Minimum, MinLength, Optional, Property} from "@tsed/schema";

/** Cursor + limit compartilhados pelas listagens keyset de reporting. */
export class KeysetPageQueryDto {
  @Optional()
  @Property(Number)
  @Integer()
  @Minimum(1)
  @Maximum(100)
  @Default(20)
  limit?: string;

  @Optional()
  @Property(String)
  @MinLength(1)
  cursor?: string;
}
