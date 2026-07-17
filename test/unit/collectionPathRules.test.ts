import test from "node:test";
import assert from "node:assert/strict";
import {
  collectionPathsConflict,
  removeParentChildPathDuplicates,
} from "../../src/recommendation/collectionPathRules.js";

test("distinguishes same-named collections under different parents", () => {
  assert.equal(
    collectionPathsConflict("Research / Labor", "Teaching / Labor"),
    false,
  );
  const values = removeParentChildPathDuplicates([
    { path: "Research / Labor", id: 1 },
    { path: "Teaching / Labor", id: 2 },
  ]);
  assert.deepEqual(
    values.map((value) => value.id),
    [1, 2],
  );
});

test("removes a parent/child duplicate while preserving the higher-ranked path", () => {
  const values = removeParentChildPathDuplicates([
    { path: "Research / Labor / Unions", id: 3 },
    { path: "Research / Labor", id: 1 },
  ]);
  assert.deepEqual(
    values.map((value) => value.id),
    [3],
  );
});
