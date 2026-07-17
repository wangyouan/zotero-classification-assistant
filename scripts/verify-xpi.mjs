import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import AdmZip from "adm-zip";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const pkg = JSON.parse(
  readFileSync(path.join(projectRoot, "package.json"), "utf8"),
);
const sourceManifest = JSON.parse(
  readFileSync(path.join(projectRoot, "addon", "manifest.json"), "utf8"),
);
const updateManifest = JSON.parse(
  readFileSync(path.join(projectRoot, "update.json"), "utf8"),
);
const expected = {
  id: pkg.config.addonID,
  version: pkg.version,
  updateURL:
    "https://raw.githubusercontent.com/wangyouan/zotero-classification-assistant/codex/phase-0-1-core-prototype/update.json",
  strictMinVersion: "9.0",
  strictMaxVersion: "9.0.*",
};
const defaultXpi = path.join(
  projectRoot,
  ".scaffold",
  "build",
  `${pkg.name}-${pkg.version}.xpi`,
);
const xpiPath = path.resolve(process.argv[2] || defaultXpi);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const bytes = readFileSync(xpiPath);
const zip = new AdmZip(bytes);
assert(zip.test(), "ZIP integrity check failed");
assert(
  sourceManifest.version === expected.version,
  "source manifest/package version mismatch",
);
assert(
  sourceManifest.applications?.zotero?.update_url === expected.updateURL,
  "source manifest has an unexpected update_url",
);
assert(
  Array.isArray(updateManifest.addons?.[expected.id]?.updates),
  "update.json does not contain a valid add-on updates array",
);

const entries = zip.getEntries();
const names = entries.map((entry) => entry.entryName);
const manifestEntry = zip.getEntry("manifest.json");
const bootstrapEntry = zip.getEntry("bootstrap.js");
const semanticRuntimeEntries = [
  "content/vendor/transformers.min.mjs",
  "content/vendor/ort-wasm-simd-threaded.mjs",
  "content/vendor/ort-wasm-simd-threaded.wasm",
  "content/vendor/TRANSFORMERS-JS-LICENSE.txt",
];
assert(
  manifestEntry && !manifestEntry.isDirectory,
  "manifest.json is not at XPI root",
);
assert(
  bootstrapEntry && !bootstrapEntry.isDirectory,
  "bootstrap.js is not at XPI root",
);
assert(
  names.filter((name) => name.toLowerCase() === "manifest.json").length === 1,
  "manifest.json has incorrect case or duplicate paths",
);
assert(
  names.filter((name) => name.toLowerCase() === "bootstrap.js").length === 1,
  "bootstrap.js has incorrect case or duplicate paths",
);
for (const required of semanticRuntimeEntries) {
  assert(
    names.includes(required),
    `missing semantic runtime asset: ${required}`,
  );
}
assert(
  !names.some((name) => name.includes(".jsep.")),
  "JSEP/WebGPU runtime must not be packaged for Zotero's CPU-only semantic backend",
);
const wasmModule = zip
  .getEntry("content/vendor/ort-wasm-simd-threaded.mjs")
  .getData()
  .toString("utf8");
assert(
  !wasmModule.includes(
    "if (isNode) isPthread = (await import('worker_threads')).workerData === 'em-pthread';",
  ),
  "ONNX WASM module still contains Zotero-incompatible top-level await",
);
const wasmBytes = zip
  .getEntry("content/vendor/ort-wasm-simd-threaded.wasm")
  .getData();
assert(
  wasmBytes.subarray(0, 4).equals(Buffer.from([0x00, 0x61, 0x73, 0x6d])),
  "packaged ONNX runtime does not have a valid WebAssembly header",
);
const addonScript = zip
  .getEntry("content/scripts/zoteroClassificationAssistant.js")
  .getData()
  .toString("utf8");
assert(
  addonScript.includes("wasmBinary") &&
    addonScript.includes("NetUtil.sys.mjs") &&
    addonScript.includes("createObjectURL") &&
    addonScript.includes("revokeObjectURL"),
  "add-on does not preload packaged WASM with a blob URL fallback",
);
assert(
  !names.some((name) => /(^|\/)model[^/]*\.onnx$/i.test(name)),
  "downloadable semantic model must not be embedded in the XPI",
);

const manifestText = manifestEntry.getData().toString("utf8");
const manifest = JSON.parse(manifestText);
const zotero = manifest.applications?.zotero;
assert(manifest.manifest_version === 2, "manifest_version must be 2");
assert(
  manifest.version === expected.version,
  "manifest/package version mismatch",
);
assert(zotero?.id === expected.id, "unexpected Zotero add-on ID");
assert(
  zotero?.strict_min_version === expected.strictMinVersion,
  "unexpected strict_min_version",
);
assert(
  zotero?.strict_max_version === expected.strictMaxVersion,
  "unexpected strict_max_version",
);
assert(
  zotero?.update_url === expected.updateURL,
  "missing or unexpected update_url",
);
assert(
  !manifestText.includes("__"),
  "manifest contains unresolved placeholders",
);

const prohibitedEntry =
  /(^|\/)(src|test|tests|node_modules|\.git)(\/|$)|(^|\/)\.env(?:\.|$)|\.pdf$|zotero\.sqlite$/i;
for (const entry of entries) {
  assert(
    !prohibitedEntry.test(entry.entryName),
    `prohibited XPI entry: ${entry.entryName}`,
  );
  if (entry.isDirectory || entry.header.size > 2_000_000) continue;
  const text = entry.getData().toString("utf8");
  const vendoredDependency = entry.entryName.startsWith("content/vendor/");
  assert(
    !/__(addonName|buildVersion|description|homepage|author|addonID|addonRef|addonInstance|env)__/.test(
      text,
    ),
    `unresolved build placeholder in ${entry.entryName}`,
  );
  assert(
    !/\bsk-[A-Za-z0-9_-]{20,}\b/.test(text),
    `possible API key in ${entry.entryName}`,
  );
  assert(
    vendoredDependency || !/[A-Za-z]:\\Users\\|\/Users\/|\/home\//.test(text),
    `local path in ${entry.entryName}`,
  );
}

const sha256 = createHash("sha256").update(bytes).digest("hex");
process.stdout.write(
  `${JSON.stringify(
    {
      xpi: xpiPath,
      size: bytes.length,
      sha256,
      entryCount: entries.length,
      manifest,
    },
    null,
    2,
  )}\n`,
);
