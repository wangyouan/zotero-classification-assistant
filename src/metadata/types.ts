export interface CreatorCandidate {
  firstName?: string;
  lastName?: string;
  name?: string;
  creatorType: string;
}

export interface MetadataInput {
  kind: "doi" | "url";
  value: string;
}

export interface MetadataCandidate {
  sourceId: string;
  sourceLabel: string;
  sourceUrl?: string;
  retrievedAt: string;
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
  extra?: Record<string, unknown>;
  warnings: string[];
}

export interface MetadataSource {
  id: string;
  canHandle(input: MetadataInput): boolean;
  fetch(
    input: MetadataInput,
    signal?: AbortSignal,
  ): Promise<MetadataCandidate[]>;
}

export type ComparableMetadataField =
  | "itemType"
  | "title"
  | "creators"
  | "abstractNote"
  | "publicationTitle"
  | "date"
  | "volume"
  | "issue"
  | "pages"
  | "DOI"
  | "url"
  | "ISSN"
  | "language";

export interface MetadataFieldComparison {
  field: ComparableMetadataField;
  currentValue: string;
  candidateValue: string;
  changed: boolean;
  defaultSelected: boolean;
  warning?: string;
}
