import swc from "unplugin-swc";
import {defineConfig} from "vitest/config";

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: {syntax: "typescript", decorators: true},
        transform: {legacyDecorator: true, decoratorMetadata: true, useDefineForClassFields: false},
        keepClassNames: true,
        target: "es2024"
      },
      module: {type: "es6"}
    })
  ],
  test: {
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/config/index.ts",
        "src/shared/application/ports/**",
        "src/shared/application/pagination/**",
        "src/shared/domain/transaction-context.ts",
        "src/shared/presentation/http/schemas/**",
        "src/modules/collaborators/application/ports/**",
        "src/modules/collaborator-documents/application/ports/**",
        "src/modules/collaborator-documents/application/contracts/*-output.ts",
        "src/modules/collaborator-documents/domain/repositories/**",
        "src/modules/collaborator-documents/presentation/http/dtos/**",
        "src/modules/collaborator-documents/presentation/http/schemas/**",
        "src/modules/collaborators/domain/repositories/**",
        "src/modules/collaborators/presentation/http/dtos/**",
        "src/modules/collaborators/presentation/http/schemas/**",
        "src/modules/document-types/application/ports/**",
        "src/modules/document-types/application/contracts/*-input.ts",
        "src/modules/document-types/domain/repositories/**",
        "src/modules/document-types/presentation/http/dtos/**",
        "src/modules/document-types/presentation/http/schemas/**",
        "src/modules/reporting/application/ports/**",
        "src/modules/reporting/application/models/**",
        "src/modules/reporting/presentation/http/dtos/**",
        "src/modules/reporting/presentation/http/schemas/**",
        "src/Server.ts",
        "src/bootstrap.ts"
      ],
      thresholds: {lines: 95, branches: 95, functions: 95, statements: 95}
    },
    projects: [
      {extends: true, test: {name: "unit", include: ["tests/unit/**/*.spec.ts"]}},
      {
        extends: true,
        test: {
          name: "http",
          include: ["tests/http/**/*.spec.ts"],
          globalSetup: ["tests/helpers/mongo-container.global.ts"],
          testTimeout: 30_000,
          hookTimeout: 120_000
        }
      },
      {extends: true, test: {name: "contract", include: ["tests/contract/**/*.spec.ts"]}},
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.spec.ts"],
          globalSetup: ["tests/helpers/mongo-container.global.ts"],
          testTimeout: 30_000,
          hookTimeout: 120_000
        }
      }
    ]
  }
});
