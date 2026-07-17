import type { ScoredItem } from "../indexing/types.js";
import type { Confidence, TagRecommendation } from "./types.js";

function confidence(score: number): Confidence {
  if (score >= 0.65) return "high";
  if (score >= 0.35) return "medium";
  return "low";
}

export function rankTags(
  similarItems: ScoredItem[],
  existingTags: Set<string>,
  maximum: number,
  includeAutomatic = false,
): TagRecommendation[] {
  const scores = new Map<
    string,
    { score: number; display: string; type: number }
  >();
  const totalWeight =
    similarItems.reduce((sum, item) => sum + item.score, 0) || 1;
  for (const similar of similarItems) {
    for (const tag of similar.item.tags) {
      if (tag.type === 1 && !includeAutomatic) continue;
      const key = tag.tag.normalize("NFKC").toLowerCase();
      const current = scores.get(key) || {
        score: 0,
        display: tag.tag,
        type: tag.type,
      };
      current.score += similar.score / totalWeight;
      if (tag.type === 0) current.type = 0;
      scores.set(key, current);
    }
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, maximum)
    .map((candidate) => {
      const alreadyAssigned = existingTags.has(candidate.display);
      return {
        tag: candidate.display,
        score: candidate.score,
        confidence: confidence(candidate.score),
        reason: "Used by the most similar papers in this library.",
        alreadyAssigned,
        tagType: candidate.type === 1 ? "automatic" : "manual",
        selected: !alreadyAssigned && candidate.type === 0,
      };
    });
}
