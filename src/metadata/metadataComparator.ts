import { normalizeDOI } from "./identifierNormalizer.js";
import type {
  ComparableMetadataField,
  CreatorCandidate,
  MetadataCandidate,
  MetadataFieldComparison,
} from "./types.js";

const FIELDS: ComparableMetadataField[] = [
  "itemType",
  "title",
  "creators",
  "abstractNote",
  "publicationTitle",
  "date",
  "volume",
  "issue",
  "pages",
  "DOI",
  "url",
  "ISSN",
  "language",
];

export function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, " ")
    .trim();
}

export function normalizedTitleSimilarity(a: string, b: string): number {
  const left = new Set(normalizeText(a).split(" ").filter(Boolean));
  const right = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (!left.size && !right.size) return 1;
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

function creatorName(creator: CreatorCandidate): string {
  return normalizeText(
    creator.name || `${creator.firstName || ""} ${creator.lastName || ""}`,
  );
}

export function creatorsEquivalent(
  current: CreatorCandidate[],
  candidate: CreatorCandidate[],
): boolean {
  if (current.length !== candidate.length) return false;
  return current.every(
    (creator, index) =>
      creatorName(creator) === creatorName(candidate[index]) &&
      creator.creatorType === candidate[index].creatorType,
  );
}

function displayCreators(creators: CreatorCandidate[] = []): string {
  return creators
    .map(
      (creator) =>
        creator.name || `${creator.firstName || ""} ${creator.lastName || ""}`,
    )
    .map((value) => value.trim())
    .filter(Boolean)
    .join("; ");
}

function stringifyValue(
  field: ComparableMetadataField,
  value: unknown,
): string {
  if (field === "creators") {
    return displayCreators((value || []) as CreatorCandidate[]);
  }
  if (field === "ISSN" && Array.isArray(value)) return value.join(", ");
  return String(value || "").trim();
}

export interface CurrentMetadata {
  itemType?: string;
  title?: string;
  creators?: CreatorCandidate[];
  abstractNote?: string;
  publicationTitle?: string;
  date?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  DOI?: string;
  url?: string;
  ISSN?: string[];
  language?: string;
}

export function compareMetadata(
  current: CurrentMetadata,
  candidate: MetadataCandidate,
): MetadataFieldComparison[] {
  const titleSimilarity = normalizedTitleSimilarity(
    current.title || "",
    candidate.title || "",
  );
  return FIELDS.map((field) => {
    const currentValue = stringifyValue(field, current[field]);
    const candidateValue = stringifyValue(field, candidate[field]);
    let changed = false;
    if (candidateValue) {
      if (field === "DOI") {
        changed = normalizeDOI(currentValue) !== normalizeDOI(candidateValue);
      } else if (field === "creators") {
        changed = !creatorsEquivalent(
          current.creators || [],
          candidate.creators || [],
        );
      } else {
        changed = normalizeText(currentValue) !== normalizeText(candidateValue);
      }
    }
    const destructive = Boolean(currentValue && candidateValue);
    const riskyTitle = field === "title" && titleSimilarity < 0.45;
    const riskyCreators = field === "creators" && destructive;
    const riskyItemType = field === "itemType" && destructive;
    const currentYear = Number.parseInt(current.date || "", 10);
    const candidateYear = Number.parseInt(candidate.date || "", 10);
    const earlierDate =
      field === "date" &&
      Number.isFinite(currentYear) &&
      Number.isFinite(candidateYear) &&
      candidateYear < currentYear;
    return {
      field,
      currentValue,
      candidateValue,
      changed,
      defaultSelected:
        changed &&
        Boolean(candidateValue) &&
        (!destructive ||
          (!riskyTitle && !riskyCreators && !riskyItemType && !earlierDate)),
      warning: riskyTitle
        ? "Low title similarity"
        : riskyCreators
          ? "Author list differs; review manually"
          : riskyItemType
            ? "Item type differs; review manually"
            : earlierDate
              ? "Candidate date is earlier than the current record"
              : undefined,
    };
  });
}
