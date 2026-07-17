import test from "node:test";
import assert from "node:assert/strict";

import {
  isSSRNRecord,
  mapCrossrefItemType,
} from "../../src/metadata/sources/crossrefMapping.js";

test("keeps SSRN DOI records as preprints", () => {
  assert.equal(isSSRNRecord("10.2139/ssrn.4115692"), true);
  assert.equal(
    mapCrossrefItemType("journal-article", "10.2139/SSRN.4115692"),
    "preprint",
  );
});

test("recognizes SSRN container metadata and generic posted content", () => {
  assert.equal(
    mapCrossrefItemType(
      "journal-article",
      "10.0000/example",
      "SSRN Electronic Journal",
    ),
    "preprint",
  );
  assert.equal(mapCrossrefItemType("posted-content"), "preprint");
  assert.equal(mapCrossrefItemType("journal-article"), "journalArticle");
});
