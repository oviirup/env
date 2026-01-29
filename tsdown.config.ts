import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/**/*.ts"],
  clean: true,
  dts: true,
  exports: true,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
});
