import { scanLibrary } from "../indexing/libraryIndexer.js";
import type { IndexedItem } from "../indexing/types.js";
import {
  cosineSimilarity,
  SEMANTIC_MODEL_DTYPE,
  SEMANTIC_MODEL_ID,
  SEMANTIC_VECTOR_DIMENSIONS,
  semanticModelService,
  type SemanticProgress,
} from "./semanticModel.js";

interface SemanticIndexEntry {
  key: string;
  textHash: string;
  dateModified?: string;
  vector: number[];
}

interface SemanticIndexFile {
  version: 1;
  libraryID: number;
  model: string;
  dtype: string;
  dimensions: number;
  entries: Record<string, SemanticIndexEntry>;
}

export interface SemanticResult {
  item: IndexedItem;
  score: number;
}

type ProgressCallback = (progress: SemanticProgress) => void;

const INDEX_DIRECTORY = PathUtils.join(
  PathUtils.profileDir,
  "zotero-classification-assistant",
  "semantic-index",
);
const EMBEDDING_BATCH_SIZE = 8;

function indexPath(libraryID: number): string {
  return PathUtils.join(INDEX_DIRECTORY, `library-${libraryID}.json`);
}

function semanticText(item: IndexedItem, includeAbstracts: boolean): string {
  const abstract = includeAbstracts ? item.abstractNote.trim() : "";
  return [item.title.trim(), abstract].filter(Boolean).join("\n");
}

function textHash(value: string): string {
  return Zotero.Utilities.Internal.sha1(value);
}

function emptyIndex(libraryID: number): SemanticIndexFile {
  return {
    version: 1,
    libraryID,
    model: SEMANTIC_MODEL_ID,
    dtype: SEMANTIC_MODEL_DTYPE,
    dimensions: SEMANTIC_VECTOR_DIMENSIONS,
    entries: {},
  };
}

function validIndex(
  value: SemanticIndexFile | undefined,
  libraryID: number,
): value is SemanticIndexFile {
  return Boolean(
    value?.version === 1 &&
    value.libraryID === libraryID &&
    value.model === SEMANTIC_MODEL_ID &&
    value.dtype === SEMANTIC_MODEL_DTYPE &&
    value.dimensions === SEMANTIC_VECTOR_DIMENSIONS &&
    value.entries,
  );
}

class SemanticIndexService {
  private indexes = new Map<number, SemanticIndexFile>();

  async rank(
    query: IndexedItem,
    corpus: IndexedItem[],
    includeAbstracts: boolean,
    maximum = 50,
    onProgress?: ProgressCallback,
  ): Promise<SemanticResult[]> {
    const index = await this.load(query.libraryID);
    await this.ensureEntries(index, corpus, includeAbstracts, onProgress);
    const queryVector = await this.vectorForItem(
      index,
      query,
      includeAbstracts,
      onProgress,
    );
    await this.save(index);
    return corpus
      .map((item) => {
        const vector = index.entries[String(item.id)]?.vector;
        return vector
          ? { item, score: cosineSimilarity(queryVector, vector) }
          : null;
      })
      .filter((value): value is SemanticResult => Boolean(value))
      .sort((left, right) => right.score - left.score)
      .slice(0, maximum);
  }

  async rebuild(
    libraryID: number,
    includeAbstracts: boolean,
    onProgress?: ProgressCallback,
  ): Promise<number> {
    const items = await scanLibrary(libraryID);
    const index = emptyIndex(libraryID);
    this.indexes.set(libraryID, index);
    await this.ensureEntries(index, items, includeAbstracts, onProgress, true);
    await this.save(index);
    return items.length;
  }

  async entryCount(libraryID: number): Promise<number> {
    return Object.keys((await this.load(libraryID)).entries).length;
  }

  async clear(): Promise<void> {
    this.indexes.clear();
    await IOUtils.remove(INDEX_DIRECTORY, {
      recursive: true,
      ignoreAbsent: true,
      retryReadonly: true,
    });
  }

  private async vectorForItem(
    index: SemanticIndexFile,
    item: IndexedItem,
    includeAbstracts: boolean,
    onProgress?: ProgressCallback,
  ): Promise<number[]> {
    const text = semanticText(item, includeAbstracts);
    if (!text) return new Array(SEMANTIC_VECTOR_DIMENSIONS).fill(0);
    const hash = textHash(text);
    const stored = index.entries[String(item.id)];
    if (
      stored?.key === item.key &&
      stored.textHash === hash &&
      stored.vector.length === SEMANTIC_VECTOR_DIMENSIONS
    ) {
      return stored.vector;
    }
    const [vector] = await semanticModelService.embed([text], onProgress);
    index.entries[String(item.id)] = {
      key: item.key,
      textHash: hash,
      dateModified: item.dateModified,
      vector,
    };
    return vector;
  }

  private async ensureEntries(
    index: SemanticIndexFile,
    items: IndexedItem[],
    includeAbstracts: boolean,
    onProgress?: ProgressCallback,
    force = false,
  ): Promise<void> {
    const pending = items.filter((item) => {
      const text = semanticText(item, includeAbstracts);
      if (!text) return false;
      const stored = index.entries[String(item.id)];
      return (
        force ||
        !stored ||
        stored.key !== item.key ||
        stored.textHash !== textHash(text) ||
        stored.vector.length !== SEMANTIC_VECTOR_DIMENSIONS
      );
    });
    if (!pending.length) return;
    for (
      let offset = 0;
      offset < pending.length;
      offset += EMBEDDING_BATCH_SIZE
    ) {
      const batch = pending.slice(offset, offset + EMBEDDING_BATCH_SIZE);
      const texts = batch.map((item) => semanticText(item, includeAbstracts));
      const vectors = await semanticModelService.embed(texts, onProgress);
      batch.forEach((item, batchIndex) => {
        index.entries[String(item.id)] = {
          key: item.key,
          textHash: textHash(texts[batchIndex]),
          dateModified: item.dateModified,
          vector: vectors[batchIndex],
        };
      });
      const completed = Math.min(offset + batch.length, pending.length);
      onProgress?.({
        phase: "index",
        status: "embedding",
        completed,
        itemCount: pending.length,
      });
      await this.save(index);
      await Zotero.Promise.delay(0);
    }
  }

  private async load(libraryID: number): Promise<SemanticIndexFile> {
    const memory = this.indexes.get(libraryID);
    if (memory) return memory;
    let stored: SemanticIndexFile | undefined;
    try {
      stored = (await IOUtils.readJSON(
        indexPath(libraryID),
      )) as SemanticIndexFile;
    } catch {
      // A missing or invalid index is rebuilt incrementally.
    }
    const index = validIndex(stored, libraryID)
      ? stored
      : emptyIndex(libraryID);
    this.indexes.set(libraryID, index);
    return index;
  }

  private async save(index: SemanticIndexFile): Promise<void> {
    await IOUtils.makeDirectory(INDEX_DIRECTORY, {
      createAncestors: true,
      ignoreExisting: true,
    });
    const path = indexPath(index.libraryID);
    await IOUtils.writeJSON(path, index, { tmpPath: `${path}.tmp` });
  }
}

export const semanticIndexService = new SemanticIndexService();
