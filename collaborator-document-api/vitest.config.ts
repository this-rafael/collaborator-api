import swc from "unplugin-swc";
import {defineConfig} from "vitest/config";

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: "typescript",
          decorators: true
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true
        },
        keepClassNames: true,
        target: "es2024"
      },
      module: {
        type: "es6"
      }
    })
  ],
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"]
    }
  }
});
