const SSRN_DOI_PREFIX = "10.2139/ssrn.";
const NBER_DOI_PATTERN = /^10\.3386\/w\d+$/i;

export type WorkingPaperSeries = "SSRN" | "NBER";

export function isSSRNRecord(doi?: string, containerTitle?: string): boolean {
  return (
    doi?.trim().toLowerCase().startsWith(SSRN_DOI_PREFIX) === true ||
    containerTitle?.trim().toLowerCase() === "ssrn electronic journal"
  );
}

export function isNBERRecord(
  doi?: string,
  containerTitle?: string,
  publisher?: string,
): boolean {
  const normalizedDOI = doi?.trim() || "";
  const descriptiveText = `${containerTitle || ""} ${publisher || ""}`
    .trim()
    .toLowerCase();
  return (
    NBER_DOI_PATTERN.test(normalizedDOI) ||
    descriptiveText.includes("nber working paper") ||
    descriptiveText.includes("national bureau of economic research")
  );
}

export function workingPaperSeries(
  doi?: string,
  containerTitle?: string,
  publisher?: string,
): WorkingPaperSeries | undefined {
  if (isSSRNRecord(doi, containerTitle)) return "SSRN";
  if (isNBERRecord(doi, containerTitle, publisher)) return "NBER";
  return undefined;
}

export function mapCrossrefItemType(
  type?: string,
  doi?: string,
  containerTitle?: string,
  publisher?: string,
): string | undefined {
  if (workingPaperSeries(doi, containerTitle, publisher)) return "preprint";
  const mapping: Record<string, string> = {
    "journal-article": "journalArticle",
    "book-chapter": "bookSection",
    "proceedings-article": "conferencePaper",
    book: "book",
    report: "report",
    dissertation: "thesis",
    posted: "preprint",
    "posted-content": "preprint",
  };
  return type ? mapping[type] : undefined;
}
