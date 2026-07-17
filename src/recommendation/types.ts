export type Confidence = "high" | "medium" | "low";

export interface EvidenceItem {
  itemID: number;
  title: string;
  score: number;
}

export interface CollectionRecommendation {
  collectionID: number;
  collectionKey: string;
  path: string;
  confidence: Confidence;
  score: number;
  reason: string;
  alreadyAssigned: boolean;
  selected: boolean;
  evidence: EvidenceItem[];
}

export interface TagRecommendation {
  tag: string;
  confidence: Confidence;
  score: number;
  reason: string;
  alreadyAssigned: boolean;
  tagType: "manual" | "automatic";
  selected: boolean;
}

export interface ClassificationRecommendation {
  collections: CollectionRecommendation[];
  tags: TagRecommendation[];
  similarItems: EvidenceItem[];
  indexedItemCount: number;
}
