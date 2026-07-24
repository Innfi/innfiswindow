/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Circular imports break module init order and defeat tree shaking.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      severity: "warn",
      comment:
        "Module imported by nothing and importing nothing — likely dead code.",
      from: {
        orphan: true,
        pathNot: [
          "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$",
          "\\.d\\.ts$",
          "(^|/)tsconfig\\.json$",
          "(^|/)(babel|webpack)\\.config\\.(js|cjs|mjs|ts|json)$",
        ],
      },
      to: {},
    },
    {
      name: "renderer-no-k8s-client",
      severity: "error",
      comment:
        "k8s API calls belong in the main process only — renderer talks IPC.",
      from: { path: "^src/renderer" },
      to: { path: "@kubernetes/client-node" },
    },
    {
      name: "renderer-no-electron-main",
      severity: "error",
      comment:
        "Renderer must not import electron directly; use the preload bridge.",
      from: { path: "^src/renderer" },
      to: { path: "^electron$" },
    },
    {
      name: "no-main-to-renderer",
      severity: "error",
      comment: "Main process must not reach into renderer code.",
      from: { path: "^src/main" },
      to: { path: "^src/renderer" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "\\.d\\.ts$" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.web.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
    },
    reporterOptions: {
      dot: { collapsePattern: "node_modules/(?:@[^/]+/[^/]+|[^/]+)" },
      archi: {
        collapsePattern:
          "^src/(main/(handlers|ipc)|preload|renderer/(src/(components|hooks|types)|components/ui|lib|store))",
      },
    },
  },
}
