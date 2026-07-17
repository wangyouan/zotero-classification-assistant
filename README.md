# Zotero Classification Assistant

Zotero Classification Assistant is a local-first Zotero desktop plugin for
organizing bibliographic items. It recommends existing collections and manual
tags, lets the user review every proposed change, and can repair metadata from
a DOI without replacing the existing Zotero item.

The current `0.1.2` build is a Phase 0/1 core prototype. It deliberately does
not monitor imports automatically, create tags or collections, replace PDFs,
merge duplicates, or upload a full library to an external service.

## Zotero compatibility

- Confirmed test-machine application: Zotero 9.0.6 (64-bit, stable) on Windows.
- Declared compatibility: Zotero 9.0 through 9.0.x.
- Zotero 9.0.6 requires `update_url`; the development XPI points to the real
  `update.json` on this branch. That manifest contains no downloadable updates
  until a release asset is published.
- Zotero 7 and 8 are not declared compatible because this prototype has not
  been tested on those versions.

## Implemented in the prototype

- official `Zotero.ItemPaneManager.registerSection()` item-pane integration;
- local library scan for top-level bibliographic items;
- lightweight English/Chinese tokenization and BM25-based similarity;
- recommendations constrained to existing collections and tags;
- explicit review, apply, and session-level undo;
- Crossref DOI metadata lookup and field-level comparison;
- duplicate-DOI and low-similarity warnings;
- optional OpenAI-compatible candidate reranking with strict allow-list
  validation;
- English and Simplified Chinese localization;
- unit tests, linting, type checking, and XPI packaging.

## Development

```bash
npm ci
npm run test:unit
npm run lint:check
npm run build
```

To run Zotero with hot reload, copy `.env.example` to `.env`, use a separate
development profile and test library, and set the local Zotero executable and
profile paths. See [Development guide](docs/DEVELOPMENT.md).

The built XPI is written to
`.scaffold/build/zotero-classification-assistant-0.1.2.xpi`. `npm run build`
also parses and validates the packaged manifest and XPI root layout.

## Safety and privacy

- All Zotero mutations use supported item APIs and `saveTx()`.
- The plugin never writes directly to `zotero.sqlite`.
- Every write requires explicit confirmation.
- Local-only classification is the default.
- Remote reranking receives only the selected paper metadata and a small set of
  locally generated candidates. It cannot introduce new collection keys or tag
  strings.
- API keys and local paths are excluded from Git.

## Known prototype limitations

- The UI still requires real-Zotero testing with a disposable profile.
- Publisher webpage translation is not yet connected; metadata repair currently
  accepts DOI strings and DOI URLs through Crossref.
- The local index is rebuilt in memory and is not yet persisted incrementally.
- API keys are isolated behind a secret-store interface but currently use a
  Zotero preference. This is documented in the settings UI and should be
  revisited before a public release.
- Group-library support has not been acceptance-tested.

Licensed under AGPL-3.0-or-later.
