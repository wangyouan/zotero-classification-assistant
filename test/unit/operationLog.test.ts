import test from "node:test";
import assert from "node:assert/strict";
import {
  deserializeSnapshot,
  serializeSnapshot,
  type ItemMutationSnapshot,
} from "../../src/storage/operationLog.js";

test("undo snapshots serialize without losing collection or tag data", () => {
  const snapshot: ItemMutationSnapshot = {
    itemID: 42,
    itemKey: "ABCDEFGH",
    fields: { title: "Before" },
    creators: [],
    tags: [{ tag: "manual", type: 0 }],
    collectionIDs: [1, 2],
    attachmentIDs: [11],
    noteIDs: [12],
    relatedItemKeys: ["ZXCVBNML"],
    createdAt: new Date(0).toISOString(),
  };
  assert.deepEqual(deserializeSnapshot(serializeSnapshot(snapshot)), snapshot);
});
