import type { ScoredItem } from "../indexing/types.js";

export interface SemanticRankedItem {
  item: ScoredItem["item"];
  score: number;
}

const RRF_K = 60;
const LEXICAL_WEIGHT = 0.45;
const SEMANTIC_WEIGHT = 0.55;

export function fuseSimilarityRanks(
  lexical: ScoredItem[],
  semantic: SemanticRankedItem[],
  maximum = 50,
): ScoredItem[] {
  const candidates = new Map<number, ScoredItem>();
  const lexicalRank = new Map<number, number>();
  const semanticRank = new Map<number, number>();

  lexical.slice(0, maximum).forEach((result, index) => {
    lexicalRank.set(result.item.id, index + 1);
    candidates.set(result.item.id, result);
  });
  semantic.slice(0, maximum).forEach((result, index) => {
    semanticRank.set(result.item.id, index + 1);
    const existing = candidates.get(result.item.id);
    if (existing) {
      existing.components.semantic = result.score;
      return;
    }
    candidates.set(result.item.id, {
      item: result.item,
      score: 0,
      components: {
        text: 0,
        manualTag: 0,
        publication: 0,
        creator: 0,
        titlePhrase: 0,
        semantic: result.score,
      },
    });
  });

  const normalization = RRF_K + 1;
  return [...candidates.values()]
    .map((candidate) => {
      const textRank = lexicalRank.get(candidate.item.id);
      const vectorRank = semanticRank.get(candidate.item.id);
      const score =
        (textRank ? LEXICAL_WEIGHT / (RRF_K + textRank) : 0) +
        (vectorRank ? SEMANTIC_WEIGHT / (RRF_K + vectorRank) : 0);
      return { ...candidate, score: Math.min(1, score * normalization) };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, maximum);
}
