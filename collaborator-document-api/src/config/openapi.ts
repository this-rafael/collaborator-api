import type {SwaggerSettings} from "@tsed/swagger";

/**
 * Configuração do Swagger/OpenAPI do Ts.ED.
 *
 * Define título, versão, descrição, esquemas reutilizáveis
 * (HalLink), cabeçalhos (ETag, RetryAfter) e resposta de
 * NotModified. O padrão `operationIdPattern: "%m"` gera
 * IDs de operação baseados no nome do método do
 * controlador.
 */
export const openApiSettings: SwaggerSettings = {
  path: "/",
  fileName: "openapi.json",
  viewPath: false,
  specVersion: "3.1.0",
  operationIdPattern: "%m",
  spec: {
    info: {
      title: "Collaborator Document API",
      version: "1.0.0",
      description:
        "Public contract for the discoverApi operation and the operational health endpoints."
    },
    components: {
      headers: {
        ETag: {
          description: 'ETag fraco no formato W/"sha256:<hash>".',
          schema: {type: "string", pattern: '^W/"sha256:[a-f0-9]{64}"$'}
        },
        RetryAfter: {
          description: "Tempo, em segundos, até uma nova tentativa.",
          schema: {type: "integer", minimum: 1}
        }
      },
      responses: {
        NotModified: {
          description:
            "A representação semântica não foi alterada desde o ETag informado. A resposta não possui corpo."
        }
      },
      schemas: {
        HalLink: {
          type: "object",
          required: ["href"],
          properties: {
            href: {type: "string"},
            templated: {type: "boolean", default: false}
          },
          additionalProperties: false
        }
      }
    } as never
  }
};
