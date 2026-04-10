/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    "@electron-toolkit/eslint-config-ts",
    "@electron-toolkit/eslint-config-prettier",
  ],
  plugins: ["simple-import-sort"],
  rules: {
    "simple-import-sort/imports": [
      "error",
      {
        groups: [
          // Node built-ins (node:*)
          ["^node:"],
          // External packages (anything not starting with . or src/)
          ["^\\w", "^@\\w"],
          // Internal absolute imports (e.g. src/...)
          ["^src/"],
          // Relative imports (. or ..)
          ["^\\."],
        ],
      },
    ],
    "simple-import-sort/exports": "error",
  },
}
