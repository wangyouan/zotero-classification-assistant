import { defineConfig } from "zotero-plugin-scaffold";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import pkg from "./package.json";

export default defineConfig({
  source: ["src", "addon"],
  dist: ".scaffold/build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  xpiName: `${pkg.name}-${pkg.version}`,
  xpiDownloadLink:
    "https://github.com/{{owner}}/{{repo}}/releases/download/v{{version}}/{{xpiName}}.xpi",

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    makeManifest: {
      // Keep addon/manifest.json authoritative so development builds do not
      // acquire an unpublished update_url from the scaffold defaults.
      enable: false,
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
        },
        bundle: true,
        target: "firefox115",
        outfile: `.scaffold/build/addon/content/scripts/${pkg.config.addonRef}.js`,
      },
    ],
    hooks: {
      "build:copyAssets": async (ctx) => {
        const vendorDir = path.join(ctx.dist, "addon", "content", "vendor");
        await mkdir(vendorDir, { recursive: true });
        const transformersDist = path.resolve(
          "node_modules/@huggingface/transformers/dist",
        );
        await Promise.all([
          copyFile(
            path.join(transformersDist, "transformers.min.js"),
            path.join(vendorDir, "transformers.min.mjs"),
          ),
          copyFile(
            path.join(transformersDist, "ort-wasm-simd-threaded.jsep.mjs"),
            path.join(vendorDir, "ort-wasm-simd-threaded.jsep.mjs"),
          ),
          copyFile(
            path.join(transformersDist, "ort-wasm-simd-threaded.jsep.wasm"),
            path.join(vendorDir, "ort-wasm-simd-threaded.jsep.wasm"),
          ),
          copyFile(
            path.resolve("node_modules/@huggingface/transformers/LICENSE"),
            path.join(vendorDir, "TRANSFORMERS-JS-LICENSE.txt"),
          ),
        ]);
      },
    },
  },

  test: {
    waitForPlugin: `() => Zotero.${pkg.config.addonInstance}.data.initialized`,
  },

  // If you need to see a more detailed log, uncomment the following line:
  // logLevel: "trace",
});
