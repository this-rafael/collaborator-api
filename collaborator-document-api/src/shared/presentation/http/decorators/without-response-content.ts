import {getJsonMethodStore} from "@tsed/schema";

/** Remove o content OpenAPI de uma resposta (ex.: 304 sem corpo). */
export function WithoutResponseContent(status: number): MethodDecorator {
  return (target, propertyKey) => {
    getJsonMethodStore(target, propertyKey).operation.getResponseOf(status).delete("content");
  };
}
