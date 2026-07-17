# Development guide

## Requirements

- Node.js 24 LTS or a currently supported LTS release;
- npm;
- Git;
- a current stable Zotero desktop installation;
- a disposable Zotero development profile and test library.

Never test mutation behavior against a production Zotero library.

## Compatibility target

Version 0.1.1 targets the confirmed test-machine installation, Zotero 9.0.6
(64-bit, stable) on Windows. Its manifest declares:

```json
{
  "strict_min_version": "9.0",
  "strict_max_version": "9.0.*"
}
```

Zotero 7 and 8 are intentionally excluded until they are tested. Do not widen
the upper bound to an unlimited wildcard. The development XPI omits
`update_url`; add one only after its update manifest is actually published.

## Install and verify

```bash
npm ci
npm run test:unit
npm run lint:check
npm run typecheck
npm run build
```

The packaged XPI is placed at
`.scaffold/build/zotero-classification-assistant-0.1.1.xpi`. The build invokes
`scripts/verify-xpi.mjs`, which checks ZIP integrity, root-level `manifest.json`
and `bootstrap.js`, manifest values, unresolved placeholders, and prohibited
source, test, secret, PDF, database, and local-path content. It prints the
artifact SHA-256 on success. The same check runs in CI through `npm run build`.

## Development profile and hot reload

1. Start Zotero's profile manager (`zotero.exe -p` on Windows).
2. Create a profile named, for example, `ZCA Development`.
3. Configure that profile with a disposable data directory and sample items.
4. Copy `.env.example` to `.env`.
5. Set `ZOTERO_PLUGIN_ZOTERO_BIN_PATH` and `ZOTERO_PLUGIN_PROFILE_PATH`.
6. Run `npm start`.

`.env`, Zotero databases, PDFs, logs, API keys, and local paths must not be
committed.

## Test fixtures for Zotero integration

The disposable library should include:

- a journal article with a DOI;
- an item without a DOI and an incorrect DOI item;
- two items sharing a DOI;
- a working paper and its published version;
- Chinese and English articles;
- same-named leaf collections under different parents;
- an item with a PDF, annotations, notes, manual and automatic tags, relations,
  and multiple collections;
- an attachment-only import.

Confirm that apply/undo preserves child objects and existing organization.

## Manual installation

After `npm run build`:

1. Start Zotero with the profile manager (`zotero.exe -p`).
2. Select a disposable profile whose data directory contains no production
   library and do not sign in to Zotero Sync.
3. Open **Tools → Plugins**, choose **Install Add-on From File**, and select
   `.scaffold/build/zotero-classification-assistant-0.1.1.xpi`.
4. Restart Zotero, open a top-level bibliographic item, and expand
   **Classification Assistant** in the right pane.
5. Confirm the preferences pane opens, then test disable/enable and uninstall.
6. Confirm the item-pane section and preferences registration are removed after
   disable/uninstall and no add-on errors appear after restart.

## Current verification boundary

Unit, lint, type, and packaging checks can run without Zotero. Loading,
preferences behavior, Crossref networking inside Zotero, and all write/undo
flows require the separate development profile. These integration checks are a
release blocker, not something to infer from compilation alone.

For the 0.1.1 compatibility repair, the reported 0.1.0 installation log was:

```text
Reading manifest: applications.zotero.strict_max_version not provided
Invalid XPI: Error: Extension is invalid
```

The archive can be considered structurally valid after `npm run verify:xpi`,
but installation success must still be recorded from the disposable Windows
profile rather than inferred from the build.
