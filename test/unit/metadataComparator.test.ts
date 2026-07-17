import test from "node:test";
import assert from "node:assert/strict";
import {
  compareMetadata,
  creatorsEquivalent,
  normalizedTitleSimilarity,
} from "../../src/metadata/metadataComparator.js";

test("title comparison ignores punctuation and case", () => {
  assert.equal(
    normalizedTitleSimilarity(
      "AI, Firms & Productivity",
      "ai firms productivity",
    ),
    1,
  );
});

test("creator comparison is ordered and normalized", () => {
  assert.equal(
    creatorsEquivalent(
      [{ firstName: "Ada", lastName: "Lovelace", creatorType: "author" }],
      [{ firstName: "ada", lastName: "lovelace", creatorType: "author" }],
    ),
    true,
  );
  assert.equal(
    creatorsEquivalent(
      [{ firstName: "Ada", lastName: "Lovelace", creatorType: "author" }],
      [{ firstName: "Grace", lastName: "Hopper", creatorType: "author" }],
    ),
    false,
  );
});

test("empty incoming fields never replace nonempty current fields", () => {
  const comparisons = compareMetadata(
    { title: "Existing title", publicationTitle: "Journal" },
    {
      sourceId: "test",
      sourceLabel: "Test",
      retrievedAt: new Date(0).toISOString(),
      title: "Existing title",
      publicationTitle: "",
      warnings: [],
    },
  );
  assert.equal(
    comparisons.find((value) => value.field === "publicationTitle")?.changed,
    false,
  );
});

test("does not preselect item-type changes or earlier candidate years", () => {
  const comparisons = compareMetadata(
    { itemType: "preprint", title: "Paper", date: "2025" },
    {
      sourceId: "test",
      sourceLabel: "Test",
      retrievedAt: new Date(0).toISOString(),
      itemType: "journalArticle",
      title: "Paper",
      date: "2024",
      warnings: [],
    },
  );
  assert.equal(
    comparisons.find((value) => value.field === "itemType")?.defaultSelected,
    false,
  );
  assert.equal(
    comparisons.find((value) => value.field === "date")?.defaultSelected,
    false,
  );
});
