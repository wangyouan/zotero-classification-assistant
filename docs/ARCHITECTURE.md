# Architecture

## Scope

The first implementation keeps a strict local-first, human-confirmed workflow:

```text
selected Zotero item
  -> local library scan
  -> BM25 plus optional local multilingual vector retrieval
  -> existing collection/tag candidates
  -> optional allow-listed remote reranking
  -> item-pane review
  -> explicit confirmation
  -> supported Zotero API write
  -> session operation snapshot and undo
```

No Phase 2 notifier or import queue is registered.

## Scaffold decision

The repository already contained the maintained
`windingwind/zotero-plugin-template` TypeScript scaffold. It is retained rather
than replaced. The plugin uses the scaffold's bootstrapped lifecycle, build,
localization, preferences, and XPI packaging support. UI registration uses the
official Zotero 7+ `ItemPaneManager` and `PreferencePanes` APIs.

## Module boundaries

- `src/indexing`: pure tokenizer and BM25 code plus the Zotero-backed library
  scanner. Binary attachments are never indexed.
- `src/semantic`: on-demand multilingual embedding runtime, profile-local model
  cache, and persistent per-library vector indexes. It never writes to Zotero's
  database.
- `src/recommendation`: transparent item scoring and constrained collection/tag
  ranking. Collection identity uses IDs and keys, with full paths for display.
- `src/metadata`: identifier normalization, deterministic comparison, repair
  orchestration, and metadata source adapters. Crossref is authoritative for the
  DOI prototype.
- `src/providers`: provider-neutral contracts, the OpenAI-compatible adapter,
  and strict response validation. Provider output never mutates Zotero.
- `src/zotero`: Zotero item/collection/tag reads and transaction-safe mutations.
  UI code does not call storage APIs directly.
- `src/storage`: settings, isolated secret access, and a session-only operation
  log.
- `src/ui`: item-pane rendering and field-level metadata review.

## Hybrid similarity

Metadata text is Unicode NFKC-normalized. Latin alphanumeric tokens have a small
English stop-word list; Chinese runs produce unigrams and bigrams. DOIs are
removed from indexed text. BM25 supplies the lexical baseline, combined with
manual-tag, publication, creator, and exact-title evidence using centralized
weights in `recommendationService.ts`.

When experimental semantic retrieval is enabled, the plugin downloads the
quantized `Xenova/multilingual-e5-small` model and runs it locally through the
packaged Transformers.js/ONNX WebAssembly runtime. The model is not embedded in
the XPI. Model files and 384-dimensional title/abstract embeddings are cached
under the active Zotero profile. Lexical and semantic top-50 lists are combined
with weighted reciprocal-rank fusion (45% lexical, 55% semantic). A failure to
load or run the model is logged and falls back to the BM25 list.

Collection ranking aggregates the best locally similar papers. Tag ranking uses
similarity-weighted frequency and, by default, considers manual tags only.
Parent/child collection duplicates and configured workflow collections are
removed.

## Mutation safety and undo

Before classification or metadata repair, the plugin captures the item key,
affected metadata fields, creators, tags, collection IDs, attachment IDs, and
note IDs. It writes through `Zotero.Item` methods and `saveTx()`, then verifies
that child attachment and note IDs did not change. Undo restores the last
session operation for the item.

This operation log is intentionally session-only in Phase 1. It is not a general
backup system.

## Remote-provider boundary

Remote mode is disabled by default. The provider receives only the current item,
locally generated candidates, and a few evidence titles. Strict validation
rejects unknown collection keys, unknown tags, duplicates, malformed JSON, and
confidence values outside `[0, 1]`. Paper text is explicitly treated as
untrusted prompt content.

## Persistence

The BM25 index is rebuilt in memory. The semantic model cache and vector index
live in the plugin's directory under the active Zotero profile and can be
deleted from preferences. Zotero remains the source of truth. No plugin code
writes to `zotero.sqlite`. API-key access is behind `SecretStore`; the current
implementation uses a local Zotero preference and exposes a clear control. A
stronger OS-backed storage mechanism should be evaluated before a public
release.
