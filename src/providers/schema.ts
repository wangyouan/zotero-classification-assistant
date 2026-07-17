import type {
  ClassificationRerankRequest,
  ClassificationRerankResponse,
} from "./types.js";

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Provider response must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function boundedConfidence(value: unknown): number {
  if (typeof value !== "number" || value < 0 || value > 1) {
    throw new Error("Provider confidence must be between 0 and 1.");
  }
  return value;
}

function reason(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Provider recommendation reason is missing.");
  }
  return value.trim().slice(0, 400);
}

export function validateRerankResponse(
  value: unknown,
  request: ClassificationRerankRequest,
): ClassificationRerankResponse {
  const root = objectValue(value);
  if (!Array.isArray(root.collections) || !Array.isArray(root.tags)) {
    throw new Error("Provider response requires collections and tags arrays.");
  }
  const allowedCollections = new Set(
    request.collections.map((candidate) => candidate.collectionKey),
  );
  const allowedTags = new Set(request.tags.map((candidate) => candidate.tag));
  const collectionKeys = new Set<string>();
  const tagNames = new Set<string>();
  const collections = root.collections.map((entry) => {
    const candidate = objectValue(entry);
    const collectionKey = candidate.collectionKey;
    if (
      typeof collectionKey !== "string" ||
      !allowedCollections.has(collectionKey)
    ) {
      throw new Error("Provider returned an unknown collection candidate.");
    }
    if (collectionKeys.has(collectionKey)) {
      throw new Error("Provider returned a duplicate collection candidate.");
    }
    collectionKeys.add(collectionKey);
    return {
      collectionKey,
      confidence: boundedConfidence(candidate.confidence),
      reason: reason(candidate.reason),
    };
  });
  const tags = root.tags.map((entry) => {
    const candidate = objectValue(entry);
    const tag = candidate.tag;
    if (typeof tag !== "string" || !allowedTags.has(tag)) {
      throw new Error("Provider returned an unknown tag candidate.");
    }
    if (tagNames.has(tag)) {
      throw new Error("Provider returned a duplicate tag candidate.");
    }
    tagNames.add(tag);
    return {
      tag,
      confidence: boundedConfidence(candidate.confidence),
      reason: reason(candidate.reason),
    };
  });
  return { collections, tags };
}
