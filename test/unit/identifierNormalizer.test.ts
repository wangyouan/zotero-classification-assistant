import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDOI,
  normalizeMetadataInput,
  normalizeURL,
} from "../../src/metadata/identifierNormalizer.js";

test("normalizes common DOI forms", () => {
  const expected = "10.1257/aer.20221705";
  assert.equal(normalizeDOI(expected), expected);
  assert.equal(normalizeDOI(`doi:${expected}`), expected);
  assert.equal(normalizeDOI(`https://doi.org/${expected}`), expected);
  assert.equal(
    normalizeDOI("http://dx.doi.org/10.1257/AER.20221705"),
    expected,
  );
});

test("rejects unsafe URLs and preserves meaningful query strings", () => {
  assert.equal(normalizeURL("javascript:alert(1)"), null);
  assert.equal(normalizeURL("file:///tmp/paper.pdf"), null);
  assert.equal(
    normalizeURL("https://example.com/article?id=42#abstract"),
    "https://example.com/article?id=42",
  );
  assert.deepEqual(normalizeMetadataInput("https://example.com/a?id=1"), {
    kind: "url",
    value: "https://example.com/a?id=1",
  });
});
