import {PlatformTest} from "@tsed/platform-http/testing";
import supertest from "supertest";

export const publishedOperation = async (
  path: string,
  method: string
): Promise<Record<string, unknown>> => {
  for (const documentPath of ["/openapi.json", "/api/openapi.json", "/docs/openapi.json"]) {
    const response = await supertest(PlatformTest.callback()).get(documentPath);
    const operation = response.body?.paths?.[path]?.[method] as Record<string, unknown> | undefined;
    if (response.status === 200 && operation) return operation;
  }
  throw new Error(`The published OpenAPI document does not expose ${method.toUpperCase()} ${path}`);
};
