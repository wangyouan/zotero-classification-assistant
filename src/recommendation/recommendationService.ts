import { rankBM25 } from "../indexing/bm25.js";
import { indexZoteroItem, scanLibrary } from "../indexing/libraryIndexer.js";
import { tokenize } from "../indexing/tokenizer.js";
import type { IndexedItem, ScoredItem } from "../indexing/types.js";
import { normalizeText } from "../metadata/metadataComparator.js";
import { rankTags } from "./tagRanker.js";
import { removeParentChildPathDuplicates } from "./collectionPathRules.js";
import { fuseSimilarityRanks } from "./hybridRanker.js";
import { semanticIndexService } from "../semantic/semanticIndex.js";
import type { SemanticProgress } from "../semantic/semanticModel.js";
import type {
  ClassificationRecommendation,
  CollectionRecommendation,
  Confidence,
  EvidenceItem,
} from "./types.js";

export interface RecommendationOptions {
  maxCollections: number;
  maxTags: number;
  includeAutomaticTags: boolean;
  includeAbstracts: boolean;
  semanticEnabled: boolean;
  excludedCollectionPaths: string[];
}

export type RecommendationProgress = (progress: SemanticProgress) => void;

function overlap(left: string[], right: string[]): number {
  const a = new Set(left.map(normalizeText).filter(Boolean));
  const b = new Set(right.map(normalizeText).filter(Boolean));
  if (!a.size || !b.size) return 0;
  return (
    [...a].filter((value) => b.has(value)).length / Math.max(a.size, b.size)
  );
}

function normalizeBM25(score: number, maximum: number): number {
  return maximum > 0 ? Math.min(1, score / maximum) : 0;
}

function confidence(score: number): Confidence {
  if (score >= 0.68) return "high";
  if (score >= 0.38) return "medium";
  return "low";
}

function isExcluded(path: string, excluded: string[]): boolean {
  const normalized = normalizeText(path);
  return excluded.some((candidate) => {
    const value = normalizeText(candidate);
    return value && (normalized === value || normalized.endsWith(` ${value}`));
  });
}

function scoreItems(query: IndexedItem, corpus: IndexedItem[]): ScoredItem[] {
  const textResults = rankBM25(
    query.tokens,
    corpus.map((item) => ({ value: item.id, tokens: item.tokens })),
  );
  const maximumText = textResults[0]?.score || 0;
  const textByID = new Map(
    textResults.map((result) => [result.value, result.score]),
  );
  const queryManualTags = query.tags
    .filter((tag) => tag.type === 0)
    .map((tag) => tag.tag);
  return corpus
    .map((item) => {
      const text = normalizeBM25(textByID.get(item.id) || 0, maximumText);
      const manualTag = overlap(
        queryManualTags,
        item.tags.filter((tag) => tag.type === 0).map((tag) => tag.tag),
      );
      const publication =
        normalizeText(query.publicationTitle) &&
        normalizeText(query.publicationTitle) ===
          normalizeText(item.publicationTitle)
          ? 1
          : 0;
      const creator = overlap(query.creators, item.creators);
      const titlePhrase =
        normalizeText(query.title) === normalizeText(item.title) ? 1 : 0;
      const score =
        0.55 * text +
        0.2 * manualTag +
        0.1 * publication +
        0.1 * creator +
        0.05 * titlePhrase;
      return {
        item,
        score,
        components: { text, manualTag, publication, creator, titlePhrase },
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score);
}

function evidence(items: ScoredItem[], maximum = 3): EvidenceItem[] {
  return items.slice(0, maximum).map(({ item, score }) => ({
    itemID: item.id,
    title: item.title,
    score,
  }));
}

function rankCollections(
  query: IndexedItem,
  similarItems: ScoredItem[],
  maximum: number,
  excluded: string[],
): CollectionRecommendation[] {
  const byCollection = new Map<number, ScoredItem[]>();
  for (const result of similarItems.slice(0, 30)) {
    for (const collectionID of result.item.collectionIDs) {
      const current = byCollection.get(collectionID) || [];
      current.push(result);
      byCollection.set(collectionID, current);
    }
  }
  const candidates = [...byCollection.entries()]
    .map(([collectionID, items]) => {
      const collection = Zotero.Collections.get(collectionID);
      const path = items.find((item) => item.item.collectionPaths[collectionID])
        ?.item.collectionPaths[collectionID];
      if (!collection || !path || isExcluded(path, excluded)) return null;
      const representative = items.slice(0, 3);
      const representativeScore =
        representative.reduce((sum, item) => sum + item.score, 0) /
        representative.length;
      const manualTags = items.flatMap((item) =>
        item.item.tags.filter((tag) => tag.type === 0).map((tag) => tag.tag),
      );
      const sharedTags = overlap(
        query.tags.filter((tag) => tag.type === 0).map((tag) => tag.tag),
        manualTags,
      );
      const score = Math.min(1, 0.8 * representativeScore + 0.2 * sharedTags);
      const alreadyAssigned = query.collectionIDs.includes(collectionID);
      return {
        collectionID,
        collectionKey: collection.key,
        path,
        score,
        confidence: confidence(score),
        reason:
          "Contains locally similar papers and overlapping subject evidence.",
        alreadyAssigned,
        selected: !alreadyAssigned,
        evidence: evidence(representative),
      } satisfies CollectionRecommendation;
    })
    .filter((value): value is CollectionRecommendation => Boolean(value))
    .sort((a, b) => b.score - a.score);
  return removeParentChildPathDuplicates(candidates).slice(0, maximum);
}

export async function recommendForItem(
  item: Zotero.Item,
  options: RecommendationOptions,
  onProgress?: RecommendationProgress,
): Promise<ClassificationRecommendation> {
  const query = indexZoteroItem(item);
  const corpus = (await scanLibrary(item.libraryID)).filter(
    (candidate) => candidate.id !== item.id,
  );
  if (!options.includeAbstracts) {
    query.tokens = tokenize(query.title);
    corpus.forEach((candidate) => {
      candidate.tokens = tokenize(candidate.title);
    });
  }
  const lexicalItems = scoreItems(query, corpus);
  let similarItems = lexicalItems.slice(0, 30);
  let semanticStatus: ClassificationRecommendation["semanticStatus"] =
    "disabled";
  let semanticWarning: string | undefined;
  if (options.semanticEnabled) {
    try {
      const semanticItems = await semanticIndexService.rank(
        query,
        corpus,
        options.includeAbstracts,
        50,
        onProgress,
      );
      similarItems = fuseSimilarityRanks(
        lexicalItems.slice(0, 50),
        semanticItems,
        50,
      ).slice(0, 30);
      semanticStatus = "used";
    } catch (error) {
      semanticStatus = "fallback";
      semanticWarning = error instanceof Error ? error.message : String(error);
      Zotero.debug(
        `[ZCA Semantic] unavailable; falling back to BM25: ${semanticWarning}`,
      );
    }
  }
  const collections = rankCollections(
    query,
    similarItems,
    options.maxCollections,
    options.excludedCollectionPaths,
  );
  const tags = rankTags(
    similarItems.slice(0, 15),
    new Set(item.getTags().map((tag) => tag.tag)),
    options.maxTags,
    options.includeAutomaticTags,
  );
  return {
    collections,
    tags,
    similarItems: evidence(similarItems, 5),
    indexedItemCount: corpus.length + 1,
    semanticStatus,
    semanticWarning,
  };
}

export { scoreItems };
