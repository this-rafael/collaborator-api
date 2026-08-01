import {err, ok, type Result} from "neverthrow";

import {
  documentTypeDomainFailure,
  type DocumentTypeDomainFailure
} from "../errors/document-type.failure.js";

/**
 * Objeto de valor que representa o nome normalizado e validado de um tipo de
 * documento.
 *
 * @remarks
 * O nome é normalizado (espaços das bordas removidos e sequências de espaços
 * colapsadas) e deve conter de 1 a 200 caracteres.
 */
export class DocumentTypeName {
  /**
   * Uso interno; instâncias válidas são obtidas pelo método estático `create`.
   *
   * @param value - Valor textual já normalizado e validado do nome.
   */
  private constructor(readonly value: string) {}

  /**
   * Valida e normaliza um nome de tipo de documento a partir de uma entrada bruta.
   *
   * @param input - Valor candidato a nome; espera-se uma `string`.
   * @returns Result com o `DocumentTypeName` em sucesso; em falha,
   * `DocumentTypeDomainFailure` com código `VALIDATION_ERROR` quando a entrada
   * não é string ou o comprimento normalizado está fora do intervalo permitido.
   */
  static create(input: unknown): Result<DocumentTypeName, DocumentTypeDomainFailure> {
    if (typeof input !== "string") {
      return err(documentTypeDomainFailure("VALIDATION_ERROR", "name must be a string"));
    }
    const value = input.trim().replace(/\s+/g, " ");
    if (value.length < 1 || value.length > 200) {
      return err(
        documentTypeDomainFailure("VALIDATION_ERROR", "name must contain 1 to 200 characters")
      );
    }
    return ok(new DocumentTypeName(value));
  }
}
