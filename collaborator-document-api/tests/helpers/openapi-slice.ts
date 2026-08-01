import {readFileSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
export const expectedOpenApiPath = resolve(repoRoot, ".ia_db", "expected_api.openapi.yaml");
export const discoveryContractPath = resolve(
  here,
  "..",
  "..",
  "..",
  "specs",
  "006-discovery-http-core",
  "contracts",
  "discover-api.openapi.yaml"
);
export const createDocumentVersionContractPath = resolve(
  repoRoot,
  "specs",
  "022-create-document-version",
  "contracts",
  "create-document-version.openapi.yaml"
);
export const listDocumentVersionsContractPath = resolve(
  repoRoot,
  "specs",
  "023-list-document-versions",
  "contracts",
  "list-document-versions.openapi.yaml"
);
export const getDocumentVersionContractPath = resolve(
  repoRoot,
  "specs",
  "024-get-document-version",
  "contracts",
  "get-document-version.openapi.yaml"
);

export type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

type ParsedYaml = JsonValue;

class YamlContext {
  private lines: string[];
  private index: number = 0;

  constructor(source: string) {
    this.lines = source.replace(/\r\n?/g, "\n").split("\n");
  }

  parse(): ParsedYaml {
    const first = this.peek();
    if (first === undefined) {
      return null;
    }
    const firstIndent = this.indentOf(first);
    const stripped = stripComment(first).trimEnd();
    if (stripped.trimStart().startsWith("- ")) {
      return this.parseArray(firstIndent);
    }
    const block = this.parseMapping(firstIndent);
    while (this.index < this.lines.length) {
      const next = this.peek();
      if (next === undefined) {
        break;
      }
      const nextIndent = this.indentOf(next);
      if (nextIndent !== firstIndent) {
        break;
      }
      const nextStripped = stripComment(next).trimEnd();
      if (nextStripped.trimStart().startsWith("- ")) {
        break;
      }
      const extra = this.parseMapping(nextIndent);
      for (const [k, v] of Object.entries(extra)) {
        block[k] = v;
      }
    }
    return block;
  }

  private peek(): string | undefined {
    let current = this.index;
    while (current < this.lines.length) {
      const line = this.lines[current] ?? "";
      const trimmed = stripComment(line).trimEnd();
      if (trimmed.trim() === "" || trimmed.trim().startsWith("#")) {
        current += 1;
        continue;
      }
      this.index = current;
      return line;
    }
    this.index = current;
    return undefined;
  }

  private indentOf(line: string): number {
    let count = 0;
    for (const char of line) {
      if (char === " ") {
        count += 1;
        continue;
      }
      if (char === "\t") {
        count += 1;
        continue;
      }
      break;
    }
    return count;
  }

  private nextChildIndent(parentIndent: number, valuePart: string): number {
    if (valuePart === "|" || valuePart === ">") {
      return parentIndent + 1;
    }
    const lookahead = this.peek();
    if (lookahead === undefined) {
      return parentIndent + 2;
    }
    const lineIndent = this.indentOf(lookahead);
    if (lineIndent < parentIndent) {
      return parentIndent + 2;
    }
    return lineIndent;
  }

  private parseBlock(minIndent: number): ParsedYaml {
    const first = this.peek();
    if (first === undefined) {
      return null;
    }
    const firstIndent = this.indentOf(first);
    if (firstIndent < minIndent) {
      return null;
    }

    const line = this.lines[this.index] ?? "";
    const trimmed = stripComment(line).trimEnd();
    if (trimmed.trimStart().startsWith("- ")) {
      return this.parseArray(firstIndent);
    }
    return this.parseMapping(firstIndent);
  }

  private consume(): string {
    const line = this.lines[this.index] ?? "";
    this.index += 1;
    return line;
  }

  private parseMapping(indent: number): JsonObject {
    const result: JsonObject = {};
    while (this.index < this.lines.length) {
      const line = this.peek();
      if (line === undefined) {
        break;
      }
      const lineIndent = this.indentOf(line);
      if (lineIndent < indent) {
        break;
      }
      if (lineIndent > indent) {
        throw new Error(`Unexpected indentation at line ${this.index + 1}: '${line}'`);
      }
      const stripped = stripComment(line).trimEnd();
      if (stripped.trim() === "" || stripped.trim().startsWith("#")) {
        this.consume();
        continue;
      }
      if (stripped.trimStart().startsWith("- ")) {
        break;
      }
      const colonIndex = findTopLevelColon(stripped);
      if (colonIndex === -1) {
        throw new Error(`Expected key:value at line ${this.index + 1}: '${line}'`);
      }
      const keyScalar = unquoteScalar(stripped.slice(0, colonIndex).trim());
      const key = typeof keyScalar === "string" ? keyScalar : String(keyScalar);
      const valuePart = stripped.slice(colonIndex + 1).trim();
      this.consume();
      if (valuePart === "" || valuePart === "|" || valuePart === ">") {
        const child = this.parseBlock(this.nextChildIndent(indent, valuePart));
        result[key] = child ?? null;
        continue;
      }
      const multiline = this.readMultilineScalar(valuePart);
      if (multiline !== undefined) {
        result[key] = multiline;
        continue;
      }
      if (valuePart.startsWith("[") || valuePart.startsWith("{")) {
        result[key] = this.parseFlowStyle(valuePart);
        continue;
      }
      const scalar = unquoteScalar(valuePart);
      result[key] = this.readFoldedScalar(indent, scalar);
    }
    return result;
  }

  private parseArray(indent: number): JsonArray {
    const result: JsonArray = [];
    while (this.index < this.lines.length) {
      const line = this.peek();
      if (line === undefined) {
        break;
      }
      const lineIndent = this.indentOf(line);
      if (lineIndent < indent) {
        break;
      }
      const stripped = stripComment(line).trimEnd();
      if (!stripped.trimStart().startsWith("-")) {
        if (lineIndent > indent) {
          throw new Error(`Unexpected indentation at line ${this.index + 1}: '${line}'`);
        }
        break;
      }
      this.consume();
      const remainder = stripComment(stripped).slice(1).trimStart();
      if (remainder === "") {
        const child = this.parseBlock(indent + 2);
        result.push(child ?? null);
        continue;
      }
      const colonIndex = findTopLevelColon(remainder);
      if (colonIndex === -1) {
        if (remainder.startsWith("[") || remainder.startsWith("{")) {
          result.push(this.parseFlowStyle(remainder));
          continue;
        }
        result.push(unquoteScalar(remainder));
        continue;
      }
      const keyScalar = unquoteScalar(remainder.slice(0, colonIndex).trim());
      const valuePart = remainder.slice(colonIndex + 1).trim();
      const key = typeof keyScalar === "string" ? keyScalar : String(keyScalar);
      const object: JsonObject = {};
      if (valuePart === "" || valuePart === "|" || valuePart === ">") {
        const child = this.parseBlock(indent + 2);
        object[key] = child ?? null;
      } else if (valuePart.startsWith("[") || valuePart.startsWith("{")) {
        object[key] = this.parseFlowStyle(valuePart);
      } else {
        object[key] = unquoteScalar(valuePart);
      }
      const inline = this.parseMapping(indent + 2);
      for (const [k, v] of Object.entries(inline)) {
        if (k in object) {
          continue;
        }
        object[k] = v;
      }
      result.push(object);
    }
    return result;
  }

  private readMultilineScalar(valuePart: string): string | undefined {
    const first = valuePart[0];
    if (first !== "'" && first !== '"') {
      return undefined;
    }
    if (valuePart.length > 1 && valuePart.endsWith(first) && valuePart.length > 2) {
      return valuePart.slice(1, -1);
    }
    if (!valuePart.startsWith(first)) {
      return undefined;
    }
    const collected: string[] = [valuePart.slice(1)];
    while (this.index < this.lines.length) {
      const raw = this.lines[this.index] ?? "";
      const stripped = stripComment(raw).trimEnd();
      this.index += 1;
      if (stripped.endsWith(first)) {
        collected.push(stripped.slice(0, -1));
        return collected
          .join("\n")
          .replace(/\n\s*\n/g, " ")
          .replace(/[ \t]+\n/g, "\n")
          .replace(/\s+/g, " ")
          .trim();
      }
      collected.push(stripped);
    }
    return collected.join("\n");
  }

  private readFoldedScalar(parentIndent: number, initial: JsonValue): JsonValue {
    if (typeof initial !== "string") {
      return initial;
    }
    if (initial.includes("\n")) {
      return initial;
    }
    const parts: string[] = [initial];
    while (this.index < this.lines.length) {
      const raw = this.lines[this.index] ?? "";
      if (raw.trim() === "" || raw.trim().startsWith("#")) {
        this.index += 1;
        parts.push("");
        continue;
      }
      const lineIndent = this.indentOf(raw);
      if (lineIndent <= parentIndent) {
        break;
      }
      const stripped = stripComment(raw).trimEnd();
      if (stripped.includes(":")) {
        break;
      }
      this.index += 1;
      parts.push(stripped.trim());
    }
    while (parts.length > 0 && parts[parts.length - 1] === "") {
      parts.pop();
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  private parseFlowStyle(input: string): JsonValue {
    const trimmed = input.trim();
    if (trimmed === "[]") {
      return [];
    }
    if (trimmed === "{}") {
      return {};
    }
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const inner = trimmed.slice(1, -1).trim();
      if (inner === "") {
        return [];
      }
      const items = splitFlow(inner, ",");
      return items.map((item) => parseFlowScalar(item.trim()));
    }
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const inner = trimmed.slice(1, -1).trim();
      if (inner === "") {
        return {};
      }
      const pairs = splitFlow(inner, ",");
      const result: JsonObject = {};
      for (const pair of pairs) {
        const colonIdx = findTopLevelColon(pair);
        if (colonIdx === -1) {
          continue;
        }
        const k = unquoteScalar(pair.slice(0, colonIdx).trim());
        const v = parseFlowScalar(pair.slice(colonIdx + 1).trim());
        if (typeof k === "string") {
          result[k] = v;
        }
      }
      return result;
    }
    return parseFlowScalar(trimmed);
  }
}

function stripComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (char === "#" && !inSingle && !inDouble) {
      return line.slice(0, i);
    }
  }
  return line;
}

function findTopLevelColon(line: string): number {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (char === ":" && !inSingle && !inDouble) {
      const next = line[i + 1];
      if (next === " " || next === "\t" || next === undefined) {
        return i;
      }
    }
  }
  return -1;
}

function unquoteScalar(value: string): JsonValue {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "~" || trimmed.toLowerCase() === "null") {
    return null;
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return Number.parseFloat(trimmed);
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function splitFlow(input: string, separator: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let buffer = "";
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      buffer += char;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      buffer += char;
      continue;
    }
    if (!inSingle && !inDouble) {
      if (char === "[" || char === "{") {
        depth += 1;
      } else if (char === "]" || char === "}") {
        depth -= 1;
      } else if (char === separator && depth === 0) {
        result.push(buffer);
        buffer = "";
        continue;
      }
    }
    buffer += char;
  }
  if (buffer.length > 0) {
    result.push(buffer);
  }
  return result;
}

function parseFlowScalar(input: string): JsonValue {
  const trimmed = input.trim();
  if (trimmed === "" || trimmed === "~" || trimmed.toLowerCase() === "null") {
    return null;
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return Number.parseFloat(trimmed);
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadYamlFile(path: string): ParsedYaml {
  const source = readFileSync(path, "utf8");
  return new YamlContext(source).parse();
}

export interface DiscoverySlice {
  openapi: string;
  path: string;
  operation: JsonObject;
  schemas: JsonObject;
  parameters: JsonObject;
  headers: JsonObject;
  responses: JsonObject;
  functionalOperationIds: string[];
}

export const expectedFunctionalOperationIds = [
  "discoverApi",
  "listCollaborators",
  "createCollaborator",
  "getCollaborator",
  "updateCollaborator",
  "deleteCollaborator",
  "listDocumentTypes",
  "createDocumentType",
  "getDocumentType",
  "updateDocumentType",
  "deleteDocumentType",
  "listCollaboratorDocuments",
  "createCollaboratorDocument",
  "getCollaboratorDocument",
  "unlinkCollaboratorDocument"
] as const;

export function selectDiscoverySlice(yaml: ParsedYaml): DiscoverySlice {
  if (!isObjectValue(yaml)) {
    throw new Error("Expected OpenAPI document must be a YAML mapping");
  }
  const openapi = typeof yaml.openapi === "string" ? yaml.openapi : "";
  const paths = isObjectValue(yaml.paths) ? yaml.paths : {};
  const pathEntry = isObjectValue(paths["/api/v1"]) ? (paths["/api/v1"] as JsonObject) : undefined;
  if (!pathEntry) {
    throw new Error("Expected /api/v1 path is missing in the contract");
  }
  const operation = isObjectValue(pathEntry.get) ? (pathEntry.get as JsonObject) : undefined;
  if (!operation) {
    throw new Error("Expected GET /api/v1 operation is missing in the contract");
  }

  const components = isObjectValue(yaml.components) ? yaml.components : {};
  const schemas = isObjectValue(components.schemas) ? (components.schemas as JsonObject) : {};
  const parameters = isObjectValue(components.parameters)
    ? (components.parameters as JsonObject)
    : {};
  const headers = isObjectValue(components.headers) ? (components.headers as JsonObject) : {};
  const responses = isObjectValue(components.responses) ? (components.responses as JsonObject) : {};

  const functionalOperationIds: string[] = [];
  for (const [pathKey, pathValue] of Object.entries(paths)) {
    if (pathKey.startsWith("/health")) {
      continue;
    }
    if (!isObjectValue(pathValue)) {
      continue;
    }
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      const op = pathValue[method];
      if (isObjectValue(op) && typeof op.operationId === "string") {
        functionalOperationIds.push(op.operationId);
      }
    }
  }

  return {
    openapi,
    path: "/api/v1",
    operation,
    schemas,
    parameters,
    headers,
    responses,
    functionalOperationIds: [...expectedFunctionalOperationIds]
  };
}

function isObjectValue(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadDiscoverySliceFromExpected(): DiscoverySlice {
  const yaml = loadYamlFile(discoveryContractPath);
  return selectDiscoverySlice(yaml);
}

export interface OperationSlice {
  path: string;
  method: string;
  operation: JsonObject;
  schemas: JsonObject;
  parameters: JsonObject;
  headers: JsonObject;
  responses: JsonObject;
}

function loadOperationSlice(source: string, path: string, method: string): OperationSlice {
  const yaml = loadYamlFile(source);
  if (!isObjectValue(yaml) || !isObjectValue(yaml.paths)) {
    throw new Error("Expected OpenAPI paths are missing");
  }
  const pathEntry = yaml.paths[path];
  const operation =
    isObjectValue(pathEntry) && isObjectValue(pathEntry[method]) ? pathEntry[method] : undefined;
  if (!operation) {
    throw new Error(`Expected ${method.toUpperCase()} ${path} operation is missing`);
  }
  const components = isObjectValue(yaml.components) ? yaml.components : {};
  return {
    path,
    method,
    operation,
    schemas: isObjectValue(components.schemas) ? components.schemas : {},
    parameters: isObjectValue(components.parameters) ? components.parameters : {},
    headers: isObjectValue(components.headers) ? components.headers : {},
    responses: isObjectValue(components.responses) ? components.responses : {}
  };
}

export function loadOperationSliceFromExpected(path: string, method: string): OperationSlice {
  return loadOperationSlice(expectedOpenApiPath, path, method);
}

export const loadCreateCollaboratorSliceFromExpected = (): OperationSlice =>
  loadOperationSliceFromExpected("/api/v1/collaborators", "post");

export const loadListCollaboratorsSliceFromExpected = (): OperationSlice =>
  loadOperationSliceFromExpected("/api/v1/collaborators", "get");

export const loadGetCollaboratorSliceFromExpected = (): OperationSlice =>
  loadOperationSliceFromExpected("/api/v1/collaborators/{id}", "get");

export const loadUpdateCollaboratorSliceFromExpected = (): OperationSlice =>
  loadOperationSliceFromExpected("/api/v1/collaborators/{id}", "patch");

export const loadDeleteCollaboratorSliceFromExpected = (): OperationSlice =>
  loadOperationSliceFromExpected("/api/v1/collaborators/{id}", "delete");

export const loadCreateDocumentTypeSliceFromExpected = (): OperationSlice =>
  loadOperationSliceFromExpected("/api/v1/document-types", "post");

export const loadListDocumentTypesSliceFromExpected = (): OperationSlice =>
  loadOperationSliceFromExpected("/api/v1/document-types", "get");

export const loadGetDocumentTypeSliceFromExpected = (): OperationSlice =>
  loadOperationSliceFromExpected("/api/v1/document-types/{id}", "get");

export const loadUpdateDocumentTypeSliceFromExpected = (): OperationSlice =>
  loadOperationSliceFromExpected("/api/v1/document-types/{id}", "patch");

export const loadDeleteDocumentTypeSliceFromExpected = (): OperationSlice =>
  loadOperationSliceFromExpected("/api/v1/document-types/{id}", "delete");

export const loadCreateCollaboratorDocumentSliceFromExpected = (): OperationSlice =>
  loadOperationSliceFromExpected("/api/v1/collaborator-documents", "post");

export const loadListCollaboratorDocumentsSliceFromExpected = (): OperationSlice =>
  loadOperationSliceFromExpected("/api/v1/collaborator-documents", "get");

export const loadGetCollaboratorDocumentSliceFromExpected = (): OperationSlice =>
  loadOperationSliceFromExpected("/api/v1/collaborator-documents/{id}", "get");

export const loadUnlinkCollaboratorDocumentSliceFromExpected = (): OperationSlice =>
  loadOperationSliceFromExpected("/api/v1/collaborator-documents/{id}", "delete");

export const loadCreateDocumentVersionSliceFromContract = (): OperationSlice =>
  loadOperationSlice(
    createDocumentVersionContractPath,
    "/api/v1/collaborator-documents/{id}/versions",
    "post"
  );

export const loadListDocumentVersionsSliceFromContract = (): OperationSlice =>
  loadOperationSlice(
    listDocumentVersionsContractPath,
    "/api/v1/collaborator-documents/{id}/versions",
    "get"
  );

export const loadGetDocumentVersionSliceFromContract = (): OperationSlice =>
  loadOperationSlice(
    getDocumentVersionContractPath,
    "/api/v1/collaborator-documents/{id}/versions/{version}",
    "get"
  );
