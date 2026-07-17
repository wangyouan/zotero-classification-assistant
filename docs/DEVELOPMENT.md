# Development guide

## Requirements

- Node.js 24 LTS or a currently supported LTS release;
- npm;
- Git;
- a current stable Zotero desktop installation;
- a disposable Zotero development profile and test library.

Never test mutation behavior against a production Zotero library.

## Install and verify

```bash
npm ci
npm run test:unit
npm run lint:check
npm run build
```

The packaged XPI is placed under `.scaffold/build/`.

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

After `npm run build`, open Zotero's add-ons manager, choose **Install Add-on
From File**, and select the XPI under `.scaffold/build/`. Open a top-level
bibliographic item and expand **Classification Assistant** in the right pane.

## Current verification boundary

Unit, lint, type, and packaging checks can run without Zotero. Loading,
preferences behavior, Crossref networking inside Zotero, and all write/undo
flows require the separate development profile. These integration checks are a
release blocker, not something to infer from compilation alone.
