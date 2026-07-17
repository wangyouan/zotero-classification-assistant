import type { CreatorCandidate } from "../metadata/types.js";
import type { CurrentMetadata } from "../metadata/metadataComparator.js";

function safeField(
  item: Zotero.Item,
  field: _ZoteroTypes.Item.ItemField,
): string {
  try {
    return String(item.getField(field) || "");
  } catch {
    return "";
  }
}

export function isEligibleBibliographicItem(
  item: Zotero.Item | null | undefined,
): item is Zotero.Item {
  return Boolean(
    item?.isRegularItem() && item.isTopLevelItem() && !item.deleted,
  );
}

export function readCurrentMetadata(item: Zotero.Item): CurrentMetadata {
  return {
    itemType: Zotero.ItemTypes.getName(item.itemTypeID),
    title: safeField(item, "title"),
    creators: item.getCreators().map(
      (creator): CreatorCandidate => ({
        firstName: creator.firstName,
        lastName: creator.lastName,
        creatorType:
          Zotero.CreatorTypes.getName(creator.creatorTypeID) || "author",
      }),
    ),
    abstractNote: safeField(item, "abstractNote"),
    publicationTitle: safeField(item, "publicationTitle"),
    date: safeField(item, "date"),
    volume: safeField(item, "volume"),
    issue: safeField(item, "issue"),
    pages: safeField(item, "pages"),
    DOI: safeField(item, "DOI"),
    url: safeField(item, "url"),
    ISSN: safeField(item, "ISSN")
      .split(/[,;]\s*/)
      .filter(Boolean),
    language: safeField(item, "language"),
  };
}

export async function findOtherItemWithDOI(
  libraryID: number,
  doi: string,
  excludingItemID: number,
): Promise<Zotero.Item | null> {
  const normalized = doi.trim().toLowerCase();
  const items = await Zotero.Items.getAll(libraryID, true, false);
  return (
    items.find(
      (item) =>
        item.id !== excludingItemID &&
        item.isRegularItem() &&
        safeField(item, "DOI").trim().toLowerCase() === normalized,
    ) || null
  );
}
