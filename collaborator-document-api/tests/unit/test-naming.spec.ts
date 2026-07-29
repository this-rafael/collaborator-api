import {readFileSync, readdirSync, statSync} from "node:fs";
import {dirname, extname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const testsRoot = resolve(here, "..");
const scannedSuites = ["unit", "http", "contract", "integration"] as const;
type ScannedSuite = (typeof scannedSuites)[number];

const callPattern =
  /\b(?:it|test|describe|it\.only|test\.only|describe\.only|it\.skip|test\.skip|describe\.skip)\s*(?:\.\s*each\s*\(\s*\[[\s\S]*?\]\s*\))?\s*\(\s*(["'`])([^"'`]*?)\1/g;

/** Scenario/module labels such as DISC-001, COL-CREATE-001, HEALTH-LIVE-001, FND-HTTP. */
const labelPattern =
  /\b(?:FND|DISC|COL|TYPE|LINK|VER|QUERY|STAT|SUB|HEALTH|CURSOR|TX)(?:-[A-Z][A-Z0-9]*)*(?:-\d{3})?\b/;

const findSpecFiles = (suite: ScannedSuite): string[] => {
  const suiteDir = join(testsRoot, suite);
  if (!statSync(suiteDir, {throwIfNoEntry: false})?.isDirectory()) {
    return [];
  }
  return readdirSync(suiteDir)
    .filter((entry) => extname(entry) === ".ts")
    .filter((entry) => entry.endsWith(".spec.ts"))
    .map((entry) => join(suiteDir, entry))
    .sort();
};

interface Violation {
  file: string;
  line: number;
  label: string;
  title: string;
}

const collectViolations = (file: string): Violation[] => {
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");
  const violations: Violation[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    callPattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = callPattern.exec(line)) !== null) {
      const title = match[2] ?? "";
      const labelMatch = title.match(labelPattern);
      if (labelMatch) {
        violations.push({file, line: i + 1, label: labelMatch[0], title});
      }
    }
  }
  return violations;
};

const isMetaTestFile = (file: string): boolean => file.endsWith("/test-naming.spec.ts");

const formatViolations = (violations: Violation[]): string => {
  const grouped = new Map<string, Violation[]>();
  for (const violation of violations) {
    const list = grouped.get(violation.file) ?? [];
    list.push(violation);
    grouped.set(violation.file, list);
  }
  const lines: string[] = [];
  for (const [file, list] of grouped) {
    lines.push(`  ${file}`);
    for (const violation of list) {
      lines.push(`    line ${violation.line}: [${violation.label}] in "${violation.title}"`);
    }
  }
  return lines.join("\n");
};

const relativePath = (file: string): string => file.split(`${testsRoot}/`).pop() ?? file;

describe("Test naming convention", () => {
  for (const suite of scannedSuites) {
    it(`rejects scenario and module labels in ${suite} suite titles`, () => {
      const specFiles = findSpecFiles(suite);
      const violations: Violation[] = [];
      for (const file of specFiles) {
        if (isMetaTestFile(file)) {
          continue;
        }
        for (const violation of collectViolations(file)) {
          violations.push({...violation, file: relativePath(violation.file)});
        }
      }
      if (violations.length > 0) {
        throw new Error(
          `Found ${violations.length} forbidden label(s) in ${suite} suite:\n${formatViolations(violations)}`
        );
      }
      expect(specFiles.length).toBeGreaterThanOrEqual(0);
    });
  }
});
