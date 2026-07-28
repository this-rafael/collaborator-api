export const fixture = <T>(factory: () => T): T => factory();

export const sequenceFixture = <T>(factory: (index: number) => T, count: number): T[] =>
  Array.from({length: count}, (_, index) => factory(index));
