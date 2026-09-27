import { defineConfig } from "eslint/config";
import next from "eslint-config-next";

export default defineConfig([
  {
    ignores: [
      ".next/**",
      ".next-dev/**",
      "node_modules/**",
      "coverage/**",
    ],
  },
  ...next,
]);
