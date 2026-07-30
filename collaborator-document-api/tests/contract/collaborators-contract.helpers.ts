import {PlatformTest} from "@tsed/platform-http/testing";
import supertest from "supertest";

/** Contratos publicam OpenAPI sem depender de uma instância MongoDB real. */
export const contractServerSettings = {
  collaborators: {provisionIndexes: false},
  documentTypes: {provisionIndexes: false}
};

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

export const responseCodes = (operation: Record<string, unknown>): string[] =>
  Object.keys(asRecord(operation.responses)).sort();

export const responseContentTypes = (
  operation: Record<string, unknown>,
  status: string
): string[] =>
  Object.keys(asRecord(asRecord(asRecord(operation.responses)[status]).content)).sort();

export const responseHeaderNames = (operation: Record<string, unknown>, status: string): string[] =>
  Object.keys(asRecord(asRecord(asRecord(operation.responses)[status]).headers)).sort();

export const requestContentTypes = (operation: Record<string, unknown>): string[] =>
  Object.keys(asRecord(asRecord(operation.requestBody).content)).sort();

export const requestSchemaReference = (operation: Record<string, unknown>): unknown =>
  asRecord(asRecord(asRecord(operation.requestBody).content)["application/json"]).schema;

export const responseSchemaReference = (
  operation: Record<string, unknown>,
  status: string,
  contentType: string
): unknown =>
  asRecord(asRecord(asRecord(asRecord(operation.responses)[status]).content)[contentType]).schema;

export const parameterNames = (operation: Record<string, unknown>): string[] => {
  const parameters = operation.parameters;
  if (!Array.isArray(parameters)) return [];
  return parameters
    .map((parameter) => asRecord(parameter).name)
    .filter((name): name is string => typeof name === "string")
    .sort();
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
