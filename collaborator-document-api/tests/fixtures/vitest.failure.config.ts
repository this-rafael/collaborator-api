import {defineConfig} from "vitest/config";

export default defineConfig({test: {include: ["tests/fixtures/intentional-failure.spec.ts"]}});
