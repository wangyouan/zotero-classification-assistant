# Zotero Classification Assistant — Codex Development Instructions

> Repository: `wangyouan/zotero-classification-assistant`  
> Working title: **Zotero Classification Assistant**  
> Document purpose: provide persistent product, architecture, implementation, and acceptance instructions for Codex/Work agents.  
> Last updated: 2026-07-17

---

## 1. Project objective

Build a Zotero desktop plugin that helps the user organize newly added academic papers.

The plugin has three core capabilities:

1. **Metadata Repair**
   - The user supplies a correct DOI or webpage URL.
   - The plugin retrieves candidate metadata.
   - It shows a field-by-field comparison.
   - The user chooses which fields to update.
   - The existing Zotero item is updated in place without losing attachments, annotations, notes, tags, collections, or relations.

2. **Local Retrieval**
   - The plugin scans the user's local Zotero collection hierarchy, existing manually assigned tags, and bibliographic metadata.
   - It finds locally similar papers and generates constrained candidate collections and tags.
   - Local retrieval must work without any external LLM API.

3. **Classification Assistant**
   - The plugin recommends collections and tags for the selected or newly added paper.
   - It prioritizes the user's existing taxonomy.
   - It explains recommendations and shows confidence.
   - Nothing is written until the user explicitly confirms.

The product is not a general-purpose Zotero chatbot. Do not add unrelated summarization, writing, citation, or conversational features during the initial implementation.

---

## 2. Non-negotiable product principles

### 2.1 Human confirmation is mandatory

The plugin may prepare and display proposed changes, but it must not silently:

- add or remove collections;
- add or remove tags;
- overwrite bibliographic metadata;
- replace PDFs;
- merge duplicate items;
- create new collections;
- create new tags.

All persistent changes require an explicit user action such as **Apply selected changes**.

### 2.2 Existing taxonomy first

Recommendations must be constrained by the user's current library:

- prefer existing collections;
- prefer existing manually assigned tags;
- recommend at most three collections by default;
- recommend approximately three to six tags by default;
- do not create new tags in the MVP;
- do not create new collections in the MVP.

The LLM, when enabled, is a reranker and explainer of locally generated candidates. It must not freely invent the user's filing structure.

### 2.3 Local-first processing

The default workflow is:

```text
Zotero item
  -> local metadata extraction
  -> local candidate retrieval
  -> optional remote LLM reranking
  -> review UI
  -> explicit user confirmation
  -> Zotero write
```

Do not send the whole Zotero library to a remote API. Send only the current item and a small, locally selected candidate set.

### 2.4 Preserve user data

Metadata repair must update the existing bibliographic item in place. It must preserve:

- child PDF and other attachments;
- PDF annotations;
- child notes;
- user notes;
- current tags unless the user separately changes them;
- current collection memberships unless the user separately changes them;
- related-item links;
- item key and attachment links;
- other plugin data.

### 2.5 Use supported Zotero APIs

Use Zotero's local JavaScript APIs and official plugin extension points. Do not modify `zotero.sqlite` directly.

Direct SQLite writes are prohibited because they bypass Zotero validation and can corrupt the database.

### 2.6 Reversible changes

Every user-confirmed mutation initiated by this plugin must create an operation record sufficient to undo that operation during the same Zotero session. At minimum, preserve the changed fields, prior tags, and prior collection memberships.

---

## 3. Target platform and development approach

### 3.1 Target

- Primary target: current stable Zotero desktop release.
- At the time of this document, the public stable download is Zotero 9.
- Use Zotero 7+ bootstrapped-plugin architecture and official modern APIs.
- Do not hard-code a compatibility maximum until the exact installed/tested Zotero version has been checked.
- Develop and test using a separate Zotero development profile and test library. Never use the user's production library for destructive testing.

### 3.2 Recommended scaffold

Prefer one of the following:

1. the current `windingwind/zotero-plugin-template` TypeScript scaffold; or
2. the official `zotero/make-it-red` sample as the minimum reference.

TypeScript is preferred. Keep dependencies limited and justified.

Before initializing anything:

1. inspect the existing repository and branch;
2. preserve existing files and history;
3. do not delete or overwrite prior work;
4. document any scaffold decision in `docs/ARCHITECTURE.md`.

### 3.3 Official UI extension points

Use the official APIs where available:

- `Zotero.ItemPaneManager.registerSection()` for the right-side assistant panel;
- `Zotero.PreferencePanes.register()` for settings;
- bootstrapped lifecycle hooks for startup/shutdown;
- Zotero notifier mechanisms for later automatic new-item detection;
- Zotero item, collection, and tag APIs for reading and writing.

Do not use fragile DOM monkey-patching when an official API exists.

---

## 4. Initial delivery scope

Codex/Work should implement this project in phases. The first development pass must complete **Phase 0 and Phase 1** before starting Phase 2.

## Phase 0 — Environment and repository foundation

Deliver:

- working TypeScript plugin scaffold;
- reproducible install/build/dev commands;
- separate Zotero development profile instructions;
- plugin loads without errors;
- plugin cleanly unloads and unregisters UI hooks;
- basic Chinese and English localization structure;
- linting and type checking;
- minimal unit-test setup;
- `README.md`;
- `docs/ARCHITECTURE.md`;
- `docs/DEVELOPMENT.md`.

The first commit must not include API keys, local Zotero paths, user library data, production database files, PDFs, or `.env` secrets.

## Phase 1 — Manual MVP

Deliver a usable manual workflow for a selected bibliographic item.

### 4.1 Item pane

Register a collapsible right-side item-pane section tentatively named:

- Chinese: `分类助手`
- English: `Classification Assistant`

The section appears only for eligible top-level bibliographic items. It should not treat attachments, notes, or annotations as independent papers.

The pane contains:

1. item status and metadata completeness;
2. **Recommend classification** button;
3. collection recommendations;
4. tag recommendations;
5. recommendation evidence;
6. **Apply selected** button;
7. **Repair metadata** button;
8. last-operation undo control;
9. loading and error states.

### 4.2 Manual classification recommendation

For the currently selected item:

- read title, abstract, creators, date, publication, DOI, URL, existing tags, and current collections;
- search the local library;
- display up to three candidate collection paths;
- display approximately three to six existing manual tags;
- show the most similar local items used as evidence;
- allow the user to select or deselect each recommendation;
- write only after confirmation;
- provide an undo action.

The MVP must work without an LLM API.

### 4.3 Manual metadata repair

Provide an input dialog accepting:

- DOI;
- DOI URL;
- publisher/article webpage URL.

The workflow is:

```text
User input
  -> normalize identifier
  -> retrieve candidate metadata
  -> detect possible duplicate DOI
  -> compare candidate with current Zotero item
  -> field-level review
  -> user selects fields
  -> update current item in place
  -> offer classification rerun
```

The comparison UI must show at least:

- item type;
- title;
- creators;
- abstract;
- publication title;
- date/year;
- volume;
- issue;
- pages or article number;
- DOI;
- URL;
- ISSN when available;
- language when available.

The user can:

- select all changed fields;
- select individual fields;
- cancel;
- apply selected fields;
- undo the update.

Do not automatically replace or download a PDF in Phase 1.

### 4.4 Minimal provider settings

Create provider abstractions, but only one remote provider needs to work in the first pass:

- generic OpenAI-compatible chat endpoint.

Required configuration:

- provider display name;
- base URL;
- API key;
- model;
- timeout;
- temperature;
- maximum output tokens;
- enable/disable;
- test connection.

The local-only recommendation path remains the default and must not require a provider.

---

## 5. Explicit Phase 1 non-goals

Do not implement these before the manual MVP is stable:

- automatic processing immediately after every import;
- full-library automatic metadata correction;
- automatic PDF replacement;
- automatic duplicate merging;
- automatic creation of new tags;
- automatic creation of new collections;
- PDF full-text upload to remote APIs;
- vector database;
- local embedding model;
- cross-device plugin-state synchronization;
- general AI chat;
- literature summarization;
- writing assistance;
- citation-network visualization;
- online literature discovery.

Create interfaces that allow later extension, but do not implement speculative features.

---

## 6. User experience specification

## 6.1 Recommendation presentation

Each collection recommendation must show:

- full collection path;
- confidence category: high, medium, or low;
- concise reason;
- whether it is already assigned;
- optional evidence: two or three similar local papers.

Each tag recommendation must show:

- exact existing tag string;
- confidence category;
- concise reason;
- whether it is already assigned;
- whether it is a manual or automatic Zotero tag.

Default behavior:

- recommend only existing manual tags;
- exclude already assigned tags from the action list or mark them as already present;
- do not convert automatic tags into manual tags without confirmation;
- do not remove any existing tags.

## 6.2 Collection hierarchy behavior

A Zotero item can belong to multiple collections.

Rules:

- show full paths, not only leaf names;
- identify collections internally by Zotero collection key/ID, never by display name alone;
- handle same-named collections in different paths;
- avoid recommending both a parent and its child unless there is a clear reason;
- if a precise child collection is recommended, do not automatically add the parent unless the user selects it separately;
- allow configurable exclusion of workflow collections such as `Inbox`, `To Read`, `Read`, `Archive`, `Temporary`, or equivalents.

## 6.3 Metadata conflict and version warnings

When candidate metadata differs substantially from the current record, show a warning rather than silently treating the candidate as correct.

Potential warnings include:

- title similarity is low;
- author list differs materially;
- DOI already exists elsewhere in the library;
- current item appears to be a working paper while the candidate appears to be the published version;
- candidate publication year is earlier than the current version;
- URL domain does not match the DOI publisher;
- candidate item type differs.

For a likely working-paper-to-published-version transition, Phase 1 may show an informational warning. It does not need to implement “create a second related item” yet.

---

## 7. Metadata repair design

## 7.1 Input normalization

Normalize DOI inputs such as:

```text
10.1257/aer.20221705
doi:10.1257/aer.20221705
https://doi.org/10.1257/aer.20221705
http://dx.doi.org/10.1257/AER.20221705
```

Store the normalized DOI without URL prefix and compare DOI values case-insensitively.

URL normalization should:

- trim whitespace;
- validate scheme;
- preserve meaningful query parameters when needed by translators;
- reject unsafe local-file and script schemes.

## 7.2 Metadata source interface

Define an interface similar to:

```ts
interface MetadataSource {
  id: string;
  canHandle(input: MetadataInput): boolean;
  fetch(
    input: MetadataInput,
    signal?: AbortSignal,
  ): Promise<MetadataCandidate[]>;
}
```

Initial sources:

1. Zotero translation/identifier mechanisms where supported;
2. DOI metadata source such as Crossref or DOI content negotiation;
3. webpage translator path for article URLs.

Do not use an LLM as the authoritative source for DOI, authors, journal, volume, issue, pages, or year.

LLMs may later assist with conflict explanation or title normalization, but factual metadata must remain traceable to a source.

## 7.3 Metadata candidate

Use a normalized internal representation:

```ts
interface MetadataCandidate {
  sourceId: string;
  sourceLabel: string;
  sourceUrl?: string;
  retrievedAt: string;
  itemType?: string;
  title?: string;
  creators?: CreatorCandidate[];
  abstractNote?: string;
  publicationTitle?: string;
  date?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  DOI?: string;
  url?: string;
  ISSN?: string[];
  language?: string;
  extra?: Record<string, unknown>;
  warnings: string[];
}
```

Keep source provenance per field when multiple sources are combined.

## 7.4 Field comparison

Implement deterministic comparison helpers:

- normalized exact match;
- whitespace and punctuation-insensitive title comparison;
- creator-list comparison;
- parsed-year comparison;
- DOI normalization;
- empty-versus-nonempty detection.

Never represent an empty incoming field as an improvement over a nonempty current field.

The default selected changes should be conservative:

- select clear corrections and missing-field additions;
- do not preselect destructive changes with low similarity;
- do not preselect removal of existing nonempty values.

## 7.5 Safe write

Update through Zotero item APIs and save transactionally where supported.

Before mutation, capture:

```ts
interface ItemMutationSnapshot {
  itemID: number;
  itemKey: string;
  fields: Record<string, unknown>;
  creators: unknown[];
  tags: unknown[];
  collectionIDs: number[];
  createdAt: string;
}
```

Only snapshot fields that the operation may change, plus tags and collections for safety verification.

After write:

- verify the item still has the same attachments;
- verify notes and annotations remain linked;
- show a success summary;
- offer undo;
- optionally offer to rerun classification.

---

## 8. Local retrieval design

## 8.1 Indexed corpus

Index top-level regular bibliographic items only.

For each item, store or derive:

- item key and library ID;
- title;
- abstract;
- creators;
- publication title;
- date/year;
- DOI;
- manual tags;
- automatic tags separately;
- collection keys and complete paths;
- normalized searchable text;
- modification timestamp.

Do not index attachment binary content in Phase 1.

## 8.2 Incremental cache

The plugin may maintain a local cache in its own storage area.

Requirements:

- cache can be rebuilt;
- cache is not the source of truth;
- records include Zotero item version or modification time;
- deleted items are removed;
- changed items are reindexed;
- no direct writes to Zotero's SQLite database;
- expose a **Rebuild local index** control in preferences or diagnostics.

A full initial scan should show progress and remain cancellable.

## 8.3 Tokenization

Support English and Chinese metadata without adding a heavyweight NLP dependency in Phase 1.

Suggested tokenizer:

- Unicode normalization;
- lowercase Latin text;
- alphanumeric word tokens;
- DOI removal from semantic text;
- punctuation removal;
- optional English stop-word filtering;
- contiguous Han-character unigrams/bigrams or a similarly lightweight deterministic approach;
- retain domain terms and acronyms.

Document the actual tokenizer and add tests for Chinese and English titles.

## 8.4 Similarity model

Implement a transparent baseline such as BM25 or TF-IDF plus metadata overlap.

A reasonable initial composite score is:

```text
itemSimilarity =
    0.55 * textSimilarity(title + abstract)
  + 0.20 * manualTagOverlap
  + 0.10 * publicationSimilarity
  + 0.10 * creatorOverlap
  + 0.05 * titleExactPhraseBonus
```

These weights are defaults, not hard scientific truths. Keep them centralized and easy to adjust.

For items with no abstract, increase the weight on title and tags.

Return the top similar items with component-level score explanations for debugging.

## 8.5 Collection profiles

Build a profile for each eligible collection using:

- collection key;
- full path;
- collection name/path tokens;
- number of indexed papers;
- centroid-like aggregate TF-IDF/BM25 evidence;
- common manual tags;
- representative papers;
- latest modification time.

Candidate collection score may combine:

```text
collectionScore =
    0.60 * similarityToRepresentativeItems
  + 0.20 * collectionProfileTextSimilarity
  + 0.15 * sharedManualTagEvidence
  + 0.05 * collectionPathTokenSimilarity
```

Do not recommend:

- deleted or unavailable collections;
- explicitly excluded collections;
- collections with no usable bibliographic evidence, unless path-name similarity is exceptionally strong;
- the item's current collections as new actions.

## 8.6 Tag candidates

Generate tag candidates from:

- manual tags on the nearest local items;
- common manual tags in top candidate collections;
- exact or near-exact terms found in title/abstract.

Score by similarity-weighted frequency.

Normalize only for matching. Display and write the exact existing Zotero tag string.

Do not merge or rename tags in Phase 1.

---

## 9. LLM provider architecture

## 9.1 Provider interface

Use a provider-neutral interface:

```ts
interface LLMProvider {
  id: string;
  validateConfig(): Promise<ProviderValidation>;
  testConnection(signal?: AbortSignal): Promise<ProviderTestResult>;
  rerankClassification(
    request: ClassificationRerankRequest,
    signal?: AbortSignal,
  ): Promise<ClassificationRerankResponse>;
}
```

Initial adapters:

- `OpenAICompatibleProvider`;
- placeholders/interfaces for DeepSeek, Zhipu/ChatGLM, Ollama, and future providers.

DeepSeek and other OpenAI-compatible services should normally use the generic adapter unless their behavior requires a dedicated implementation.

## 9.2 Remote request minimization

A classification request may include:

- current paper title;
- abstract, if user permits;
- creators, year, publication;
- locally generated candidate collections with keys and short profiles;
- locally generated existing tag candidates;
- a few similar local-paper titles and abstracts, subject to privacy settings.

It must not include by default:

- full library dump;
- full PDFs;
- annotations;
- personal notes;
- API keys in prompts;
- unrelated collection names;
- attachment file paths.

## 9.3 Structured output

Require strict JSON and validate it against a schema.

The model must return candidate identifiers supplied by the plugin:

```json
{
  "collections": [
    {
      "collectionKey": "ABC123",
      "confidence": 0.91,
      "reason": "Closely matches hospital union and patient-outcome papers."
    }
  ],
  "tags": [
    {
      "tag": "labor union",
      "confidence": 0.94,
      "reason": "The paper studies unionization."
    }
  ]
}
```

Reject and safely handle:

- unknown collection keys;
- tags not present in the allowed candidate set;
- malformed JSON;
- duplicate entries;
- out-of-range confidence;
- prompt-injection-like content from paper text.

An LLM response must never directly execute a Zotero mutation.

## 9.4 API-key handling

- never commit keys;
- never print keys in logs;
- mask keys in the UI;
- do not include keys in exported diagnostics;
- isolate secret handling behind a storage interface;
- storing a key locally must require explicit user action;
- document clearly where and how the key is stored;
- provide a **Clear API key** control.

---

## 10. Preferences

Create a Zotero preference pane with these groups.

### General

- language;
- enable local classification;
- maximum collection recommendations;
- maximum tag recommendations;
- include abstracts in local search;
- include automatic tags as evidence;
- excluded collection paths;
- show recommendation explanations;
- confirm before every write.

The confirmation setting must remain enabled in the MVP and may be non-editable.

### Provider

- local-only / remote-assisted mode;
- provider;
- base URL;
- model;
- API key;
- timeout;
- temperature;
- maximum output tokens;
- send abstract;
- send similar-paper abstracts;
- test connection.

### Index

- indexed item count;
- last rebuild time;
- rebuild local index;
- clear cache;
- diagnostic summary.

### Privacy

Show a plain-language preview of which data categories may leave the machine. The default must be local-only.

---

## 11. Proposed source structure

Adapt to the selected scaffold, but preserve clear module boundaries.

```text
src/
├── addon.ts
├── bootstrap/
│   ├── lifecycle.ts
│   └── windowHooks.ts
├── zotero/
│   ├── itemRepository.ts
│   ├── collectionRepository.ts
│   ├── tagRepository.ts
│   ├── notifier.ts
│   └── transactions.ts
├── metadata/
│   ├── metadataRepairService.ts
│   ├── metadataComparator.ts
│   ├── identifierNormalizer.ts
│   ├── sources/
│   │   ├── metadataSource.ts
│   │   ├── zoteroTranslatorSource.ts
│   │   ├── crossrefSource.ts
│   │   └── webpageSource.ts
│   └── types.ts
├── indexing/
│   ├── libraryIndexer.ts
│   ├── tokenizer.ts
│   ├── localIndex.ts
│   ├── bm25.ts
│   └── types.ts
├── recommendation/
│   ├── recommendationService.ts
│   ├── itemSimilarity.ts
│   ├── collectionRanker.ts
│   ├── tagRanker.ts
│   └── types.ts
├── providers/
│   ├── llmProvider.ts
│   ├── openAICompatibleProvider.ts
│   ├── schema.ts
│   └── types.ts
├── ui/
│   ├── itemPane/
│   ├── metadataRepairDialog/
│   ├── preferences/
│   └── components/
├── storage/
│   ├── settingsStore.ts
│   ├── cacheStore.ts
│   ├── operationLog.ts
│   └── secretStore.ts
├── localization/
└── utils/
```

Avoid putting Zotero API calls directly inside UI components.

---

## 12. Error handling and diagnostics

Every network call must support:

- timeout;
- cancellation where possible;
- non-2xx response handling;
- readable error messages;
- no secret leakage;
- retry only when safe;
- rate-limit recognition.

Every long local operation must:

- avoid freezing the Zotero UI;
- yield periodically;
- show progress;
- support cancellation where practical.

Diagnostic logs should include:

- plugin version;
- Zotero version;
- operating system;
- operation name;
- anonymized error details;
- provider type without API key;
- source name;
- duration.

Logs must not include full abstracts, notes, PDFs, API keys, or complete private collection structures unless the user explicitly exports a diagnostic package and is shown what it contains.

---

## 13. Testing requirements

## 13.1 Unit tests

At minimum, test:

- DOI normalization;
- URL validation;
- title normalization and comparison;
- creator-list comparison;
- English tokenization;
- Chinese tokenization;
- BM25/TF-IDF ranking;
- tag candidate scoring;
- collection-path handling;
- same-name collections in different paths;
- structured LLM response validation;
- unknown candidate rejection;
- undo snapshot serialization.

## 13.2 Integration tests

Use a disposable Zotero test library containing:

- journal article with DOI;
- article without DOI;
- working paper;
- duplicate DOI;
- incorrect DOI;
- URL-only item;
- item with PDF, annotations, notes, tags, and several collections;
- same-named leaf collections under different parents;
- Chinese-language article;
- English-language article;
- attachment-only import.

Verify:

1. metadata repair preserves child objects;
2. collection addition does not duplicate the item;
3. tag addition does not remove existing tags;
4. undo restores previous state;
5. plugin restart does not corrupt cached state;
6. plugin disable/uninstall removes registered UI safely.

## 13.3 Manual acceptance test

The Phase 1 MVP is accepted only when the following end-to-end scenario works:

1. Select an existing journal article.
2. Open the Classification Assistant pane.
3. Run local recommendation with no API configured.
4. See plausible existing collection and tag candidates with evidence.
5. Select some candidates and apply them.
6. Confirm the item is added to those collections and tags without losing existing data.
7. Undo the classification operation.
8. Open Metadata Repair.
9. Paste a correct DOI or publisher URL.
10. View a field-level comparison.
11. Apply only selected fields.
12. Confirm PDF, annotations, notes, collections, tags, and relations are preserved.
13. Undo the metadata repair.
14. Configure a generic OpenAI-compatible endpoint.
15. Test the connection.
16. Run remote-assisted reranking.
17. Confirm that only locally allowed candidates can be returned and no mutation occurs until confirmation.

---

## 14. Phase 2 — after Phase 1 approval

Do not start this phase until the user has reviewed the manual MVP.

Phase 2 may add:

- notifier-based detection of newly added bibliographic items;
- debounce and delayed processing while Zotero finishes metadata/PDF recognition;
- classification review queue;
- batch processing of unfiled items;
- configurable creation of new tags;
- local embeddings through Ollama;
- cloud embedding adapters;
- improved working-paper/published-version detection;
- metadata audit for a selected collection;
- feedback learning from accepted/rejected recommendations;
- tag-cleanup suggestions;
- collection-structure diagnostics.

Automatic detection still must lead to a review queue, not silent writes.

A possible event flow is:

```text
item add/modify event
  -> ignore attachments and notes
  -> debounce
  -> wait until stable metadata is available
  -> index item
  -> prepare local recommendations
  -> mark "review available"
  -> user opens pane and confirms
```

---

## 15. Coding rules for Codex/Work

1. Read this file before making changes.
2. Inspect the repository before choosing a scaffold.
3. Do not perform destructive repository operations.
4. Keep commits small and scoped.
5. Do not mix formatting-only changes with feature changes.
6. Do not invent Zotero API signatures. Verify them in official documentation, Zotero source, or maintained examples.
7. Prefer official Zotero extension points over monkey-patching.
8. Do not write directly to `zotero.sqlite`.
9. Do not add telemetry.
10. Do not send user data remotely without an explicit enabled provider and visible settings.
11. Do not log secrets.
12. Do not implement Phase 2 before Phase 1 acceptance.
13. When blocked by an undocumented Zotero API, create a minimal experimental branch or test script and document the result.
14. Update `docs/ARCHITECTURE.md` when module boundaries or persistence decisions change.
15. Add tests for bug fixes where feasible.
16. At the end of each work session, report:
    - files changed;
    - commands run;
    - tests/build results;
    - known limitations;
    - next concrete step.

---

## 16. Initial execution checklist

Codex/Work should begin with the following sequence:

1. Inspect repository status, branches, existing files, and package configuration.
2. Identify the installed Zotero version and create a separate development profile.
3. Select and document the plugin scaffold.
4. Make the plugin build and load.
5. Register a minimal item-pane section.
6. Add typed repositories for Zotero items, collections, and tags.
7. Implement DOI normalization and metadata comparison tests.
8. Implement a local library scanner and lightweight text index.
9. Implement manual local collection/tag recommendations.
10. Implement review and explicit apply flow.
11. Implement mutation snapshots and undo.
12. Implement metadata repair dialog and one reliable DOI metadata source.
13. Add URL translation support.
14. Add generic OpenAI-compatible provider and schema validation.
15. Complete the Phase 1 manual acceptance test.
16. Package a test XPI and document installation.

Do not skip directly to LLM integration before local retrieval and safe writes work.

---

## 17. Open product decisions

These decisions should remain configurable or be confirmed after the first prototype:

- final plugin name and icon;
- final plugin ID;
- exact collection exclusion defaults;
- whether automatic Zotero tags may be recommended;
- whether a new tag can be proposed in Phase 2;
- whether group libraries are supported initially;
- whether the user wants only personal-library scanning by default;
- preferred default model providers;
- whether abstracts from similar local papers may be sent remotely;
- how long undo history should persist;
- whether metadata repair should later support PMID, arXiv ID, ISBN, CNKI, SSRN, and NBER identifiers.

For Phase 1, use conservative defaults:

- personal library first;
- local-only;
- manual tags only;
- no new tags;
- no new collections;
- no PDF replacement;
- explicit confirmation for every write;
- session-level undo.

---

## 18. Reference material

Use current official or maintained sources rather than relying on memory:

- [Zotero plugin development](https://www.zotero.org/support/dev/client_coding/plugin_development)
- [Zotero 7+ developer migration and UI APIs](https://www.zotero.org/support/dev/zotero_7_for_developers)
- [Zotero local JavaScript API](https://www.zotero.org/support/dev/client_coding/javascript_api)
- [Zotero warning on direct SQLite access](https://www.zotero.org/support/dev/client_coding/direct_sqlite_database_access)
- [Official Zotero sample plugin](https://github.com/zotero/make-it-red)
- [Maintained TypeScript Zotero plugin template](https://github.com/windingwind/zotero-plugin-template)

When documentation is incomplete, inspect the current Zotero source and maintained plugin examples, and record the exact tested Zotero version.
