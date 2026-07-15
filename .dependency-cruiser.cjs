/**
 * dependency-cruiser config for the Graphify architecture toolchain.
 * Used only by the analysis scripts under scripts/graphify/. Does NOT affect
 * the application build or runtime in any way.
 */
module.exports = {
  options: {
    // Only analyze first-party source. node_modules are counted as external
    // fan-out but never traversed.
    includeOnly: "^src",
    doNotFollow: { path: "node_modules" },

    // Resolve the "@/*" -> "./src/*" alias and .ts/.tsx via the app tsconfig.
    tsConfig: { fileName: "tsconfig.app.json" },
    tsPreCompilationDeps: true,

    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
      mainFields: ["module", "main", "types", "typings"],
    },

    // Keep generated artifacts and tests out of the module graph.
    exclude: {
      path: "\\.(test|spec)\\.[jt]sx?$|src/test/|vite-env\\.d\\.ts$",
    },

    reporterOptions: {
      dot: { collapsePattern: "node_modules/(?:@[^/]+/[^/]+|[^/]+)" },
    },
  },
};
