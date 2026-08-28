import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  source: ["src", "addon"],
  dist: "build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      description: pkg.description,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}"
    },
    esbuildOptions: [
      {
        entryPoints: [{ in: "src/index.ts", out: pkg.config.addonRef }],
        bundle: true,
        target: "firefox140",
        outdir: "build/addon/chrome/content/scripts"
      }
    ]
  }
});
