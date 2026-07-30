/** Gera identificadores antes da persistência do agregado. */
export interface IdGenerator {
  next(): string;
}
