import test from "node:test";
import assert from "node:assert/strict";
import { tokenize } from "../../src/indexing/tokenizer.js";
import { rankBM25 } from "../../src/indexing/bm25.js";
import { rankTags } from "../../src/recommendation/tagRanker.js";
import type { ScoredItem } from "../../src/indexing/types.js";

test("English tokenizer removes stop words and retains domain terms", () => {
  const tokens = tokenize("The effect of labor unions on hospital outcomes");
  assert.equal(tokens.includes("the"), false);
  assert.equal(tokens.includes("unions"), true);
  assert.equal(tokens.includes("hospital"), true);
});

test("Chinese tokenizer creates unigrams and bigrams", () => {
  const tokens = tokenize("企业漂绿行为");
  assert.equal(tokens.includes("漂"), true);
  assert.equal(tokens.includes("漂绿"), true);
  assert.equal(tokens.includes("企业"), true);
});

test("BM25 ranks the matching paper first", () => {
  const ranked = rankBM25(tokenize("hospital union outcomes"), [
    { value: "relevant", tokens: tokenize("nurse union hospital outcomes") },
    { value: "other", tokens: tokenize("asset pricing stock returns") },
  ]);
  assert.equal(ranked[0].value, "relevant");
});

test("tag ranking uses weighted frequency and excludes automatic tags", () => {
  const base = {
    id: 1,
    key: "A",
    libraryID: 1,
    title: "Paper",
    abstractNote: "",
    creators: [],
    publicationTitle: "",
    date: "",
    DOI: "",
    collectionIDs: [],
    collectionPaths: {},
    tokens: [],
  };
  const items: ScoredItem[] = [
    {
      item: {
        ...base,
        tags: [
          { tag: "labor union", type: 0 },
          { tag: "automatic", type: 1 },
        ],
      },
      score: 0.8,
      components: {
        text: 1,
        manualTag: 0,
        publication: 0,
        creator: 0,
        titlePhrase: 0,
      },
    },
  ];
  const ranked = rankTags(items, new Set(), 6, false);
  assert.deepEqual(
    ranked.map((value) => value.tag),
    ["labor union"],
  );
});
