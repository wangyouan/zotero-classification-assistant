import { tokenize } from "./tokenizer.js";
import type { IndexedItem } from "./types.js";

function collectionPath(collectionID: number): string {
  const names: string[] = [];
  const visited = new Set<number>();
  let currentID: number | undefined = collectionID;
  while (currentID && !visited.has(currentID)) {
    visited.add(currentID);
    const collection: Zotero.Collection | undefined =
      Zotero.Collections.get(currentID);
    if (!collection) break;
    names.unshift(collection.name);
    currentID = collection.parentID || undefined;
  }
  return names.join(" / ");
}

function field(item: Zotero.Item, name: _ZoteroTypes.Item.ItemField): string {
  try {
    return String(item.getField(name) || "");
  } catch {
    return "";
  }
}

export function indexZoteroItem(item: Zotero.Item): IndexedItem {
  const title = field(item, "title");
  const abstractNote = field(item, "abstractNote");
  const publicationTitle = field(item, "publicationTitle");
  const creators = item
    .getCreators()
    .map((creator) =>
      `${creator.firstName || ""} ${creator.lastName || ""}`.trim(),
    )
    .filter(Boolean);
  const collectionIDs = item.getCollections();
  const collectionPaths = Object.fromEntries(
    collectionIDs.map((id) => [id, collectionPath(id)]),
  );
  return {
    id: item.id,
    key: item.key,
    libraryID: item.libraryID,
    title,
    abstractNote,
    creators,
    publicationTitle,
    date: field(item, "date"),
    DOI: field(item, "DOI"),
    tags: item.getTags().map((tag) => ({
      tag: tag.tag,
      type: tag.type ?? 0,
    })),
    collectionIDs,
    collectionPaths,
    tokens: tokenize(`${title}\n${abstractNote}`),
    dateModified: item.dateModified,
  };
}

export async function scanLibrary(libraryID: number): Promise<IndexedItem[]> {
  const items = await Zotero.Items.getAll(libraryID, true, false);
  const indexed: IndexedItem[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.isRegularItem() && item.isTopLevelItem()) {
      indexed.push(indexZoteroItem(item));
    }
    if (index > 0 && index % 100 === 0) {
      await Zotero.Promise.delay(0);
    }
  }
  return indexed;
}

export { collectionPath };
