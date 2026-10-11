import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "public/**",
    "next-env.d.ts",
  ]),
  {
    // bulletproof-react 단방향 의존: shared → features → app
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            { target: "./src/features", from: "./src/app" },
            {
              target: [
                "./src/components",
                "./src/hooks",
                "./src/lib",
                "./src/types",
                "./src/utils",
              ],
              from: ["./src/features", "./src/app"],
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
