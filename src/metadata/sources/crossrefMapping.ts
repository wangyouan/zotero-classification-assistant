const SSRN_DOI_PREFIX = "10.2139/ssrn.";

export function isSSRNRecord(doi?: string, containerTitle?: string): boolean {
  return (
    doi?.trim().toLowerCase().startsWith(SSRN_DOI_PREFIX) === true ||
    containerTitle?.trim().toLowerCase() === "ssrn electronic journal"
  );
}

export function mapCrossrefItemType(
  type?: string,
  doi?: string,
  containerTitle?: string,
): string | undefined {
  if (isSSRNRecord(doi, containerTitle)) return "preprint";
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
