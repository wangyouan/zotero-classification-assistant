import test from "node:test";
import assert from "node:assert/strict";
import { validateRerankResponse } from "../../src/providers/schema.js";
import type { ClassificationRerankRequest } from "../../src/providers/types.js";

const request: ClassificationRerankRequest = {
  item: { title: "Paper", creators: [] },
  collections: [
    { collectionKey: "ABC", path: "Research / Labor", localScore: 0.5 },
  ],
  tags: [{ tag: "labor union", localScore: 0.6 }],
  similarItems: [],
};

test("accepts only supplied collection and tag candidates", () => {
  const valid = validateRerankResponse(
    {
      collections: [{ collectionKey: "ABC", confidence: 0.9, reason: "Match" }],
      tags: [{ tag: "labor union", confidence: 0.8, reason: "Topic" }],
    },
    request,
  );
  assert.equal(valid.collections[0].collectionKey, "ABC");
  assert.throws(() =>
    validateRerankResponse(
      {
        collections: [
          { collectionKey: "INVENTED", confidence: 0.9, reason: "No" },
        ],
        tags: [],
      },
      request,
    ),
  );
  assert.throws(() =>
    validateRerankResponse(
      {
        collections: [],
        tags: [{ tag: "invented", confidence: 0.8, reason: "No" }],
      },
      request,
    ),
  );
});
