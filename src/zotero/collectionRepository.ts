import { collectionPath } from "../indexing/libraryIndexer.js";

export interface CollectionDescriptor {
  id: number;
  key: string;
  path: string;
}

export function getCollectionDescriptor(
  collectionID: number,
): CollectionDescriptor | null {
  const collection = Zotero.Collections.get(collectionID);
  if (!collection) return null;
  return {
    id: collection.id,
    key: collection.key,
    path: collectionPath(collection.id),
  };
}

export function getLibraryCollections(
  libraryID: number,
): CollectionDescriptor[] {
  return Zotero.Collections.getByLibrary(libraryID, true).map((collection) => ({
    id: collection.id,
    key: collection.key,
    path: collectionPath(collection.id),
  }));
}
