import test from "node:test";
import assert from "node:assert/strict";

import {
  isNBERRecord,
  isSSRNRecord,
  mapCrossrefItemType,
  workingPaperSeries,
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

test("keeps NBER working papers as preprints", () => {
  assert.equal(isNBERRecord("10.3386/w33345"), true);
  assert.equal(isNBERRecord("10.3386/W23396"), true);
  assert.equal(workingPaperSeries("10.3386/w33345"), "NBER");
  assert.equal(mapCrossrefItemType("report", "10.3386/w33345"), "preprint");
  assert.equal(
    mapCrossrefItemType(
      "report",
      "10.0000/example",
      undefined,
      "National Bureau of Economic Research",
    ),
    "preprint",
  );
});

test("does not treat unrelated 10.3386 records as NBER working papers", () => {
  assert.equal(isNBERRecord("10.3386/not-a-working-paper"), false);
  assert.equal(
    mapCrossrefItemType("report", "10.3386/not-a-working-paper"),
    "report",
  );
});
