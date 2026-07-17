import type {
  ComparableMetadataField,
  MetadataCandidate,
} from "../metadata/types.js";
import type { ClassificationRecommendation } from "../recommendation/types.js";
import {
  operationLog,
  type ItemMutationSnapshot,
  type OperationRecord,
} from "../storage/operationLog.js";
import { readCurrentMetadata } from "./itemRepository.js";

function snapshotItem(item: Zotero.Item): ItemMutationSnapshot {
  const current = readCurrentMetadata(item);
  return {
    itemID: item.id,
    itemKey: item.key,
    fields: current,
    creators: item.getCreators(),
    tags: item.getTags().map((tag) => ({ tag: tag.tag, type: tag.type ?? 0 })),
    collectionIDs: [...item.getCollections()],
    attachmentIDs: [...item.getAttachments(false)],
    noteIDs: [...item.getNotes(false)],
    relatedItemKeys: [...item.relatedItems],
    createdAt: new Date().toISOString(),
  };
}

function verifyChildren(
  item: Zotero.Item,
  snapshot: ItemMutationSnapshot,
): void {
  const attachments = item.getAttachments(false).sort((a, b) => a - b);
  const notes = item.getNotes(false).sort((a, b) => a - b);
  const snapshotAttachments = [...snapshot.attachmentIDs].sort((a, b) => a - b);
  const snapshotNotes = [...snapshot.noteIDs].sort((a, b) => a - b);
  if (
    attachments.join(",") !== snapshotAttachments.join(",") ||
    notes.join(",") !== snapshotNotes.join(",") ||
    [...item.relatedItems].sort().join(",") !==
      [...snapshot.relatedItemKeys].sort().join(",")
  ) {
    throw new Error(
      "Child attachments, notes, or related-item links changed unexpectedly.",
    );
  }
}

export async function applyClassification(
  item: Zotero.Item,
  recommendation: ClassificationRecommendation,
): Promise<OperationRecord> {
  const snapshot = snapshotItem(item);
  for (const collection of recommendation.collections) {
    if (collection.selected && !collection.alreadyAssigned) {
      item.addToCollection(collection.collectionID);
    }
  }
  for (const tag of recommendation.tags) {
    if (tag.selected && !tag.alreadyAssigned && tag.tagType === "manual") {
      item.addTag(tag.tag, 0);
    }
  }
  await item.saveTx();
  verifyChildren(item, snapshot);
  const record: OperationRecord = {
    type: "classification",
    snapshot,
    changedFields: [],
    createdAt: new Date().toISOString(),
  };
  operationLog.push(record);
  return record;
}

const FIELD_MAP: Partial<
  Record<ComparableMetadataField, _ZoteroTypes.Item.ItemField>
> = {
  title: "title",
  abstractNote: "abstractNote",
  publicationTitle: "publicationTitle",
  date: "date",
  volume: "volume",
  issue: "issue",
  pages: "pages",
  DOI: "DOI",
  url: "url",
  ISSN: "ISSN",
  language: "language",
};

export async function applyMetadataChanges(
  item: Zotero.Item,
  candidate: MetadataCandidate,
  selectedFields: ComparableMetadataField[],
): Promise<OperationRecord> {
  const snapshot = snapshotItem(item);
  for (const field of selectedFields) {
    if (field === "creators" && candidate.creators?.length) {
      item.setCreators(
        candidate.creators.map((creator) => ({
          firstName: creator.firstName,
          lastName: creator.lastName,
          name: creator.name,
          creatorType: creator.creatorType as _ZoteroTypes.Item.CreatorType,
        })),
      );
      continue;
    }
    if (field === "itemType" && candidate.itemType) {
      const typeID = Zotero.ItemTypes.getID(candidate.itemType);
      if (typeID) item.setType(typeID);
      continue;
    }
    const zoteroField = FIELD_MAP[field];
    const value = candidate[field];
    if (!zoteroField || value == null || value === "") continue;
    item.setField(
      zoteroField,
      Array.isArray(value) ? value.join(", ") : String(value),
    );
  }
  await item.saveTx();
  verifyChildren(item, snapshot);
  const record: OperationRecord = {
    type: "metadata",
    snapshot,
    changedFields: selectedFields,
    createdAt: new Date().toISOString(),
  };
  operationLog.push(record);
  return record;
}

export async function undoLastOperation(item: Zotero.Item): Promise<boolean> {
  const record = operationLog.peek(item.id);
  if (!record || record.snapshot.itemKey !== item.key) return false;
  item.setTags(record.snapshot.tags);
  item.setCollections(record.snapshot.collectionIDs);
  if (record.type === "metadata") {
    for (const field of record.changedFields) {
      if (field === "creators") {
        item.setCreators(
          record.snapshot.creators as _ZoteroTypes.Item.Creator[],
        );
        continue;
      }
      if (field === "itemType") {
        const itemType = record.snapshot.fields.itemType;
        const typeID = itemType
          ? Zotero.ItemTypes.getID(String(itemType))
          : false;
        if (typeID) item.setType(typeID);
        continue;
      }
      const zoteroField = FIELD_MAP[field];
      if (!zoteroField) continue;
      const oldValue = record.snapshot.fields[field];
      item.setField(
        zoteroField,
        Array.isArray(oldValue) ? oldValue.join(", ") : String(oldValue || ""),
      );
    }
  }
  await item.saveTx();
  verifyChildren(item, record.snapshot);
  operationLog.pop(item.id);
  return true;
}
