import swc from "unplugin-swc";
import {defineConfig} from "vitest/config";

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: {syntax: "typescript", decorators: true},
        transform: {legacyDecorator: true, decoratorMetadata: true},
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
        "src/modules/collaborators/domain/repositories/**",
        "src/modules/collaborators/presentation/http/dtos/**",
        "src/modules/collaborators/presentation/http/schemas/**"
      ],
      thresholds: {lines: 90, branches: 90, functions: 90, statements: 90}
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
