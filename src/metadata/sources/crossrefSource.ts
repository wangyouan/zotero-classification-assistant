import type {
  CreatorCandidate,
  MetadataCandidate,
  MetadataInput,
  MetadataSource,
} from "../types.js";
import { mapCrossrefItemType, workingPaperSeries } from "./crossrefMapping.js";

interface CrossrefAuthor {
  given?: string;
  family?: string;
  name?: string;
}

interface CrossrefMessage {
  type?: string;
  title?: string[];
  author?: CrossrefAuthor[];
  abstract?: string;
  "container-title"?: string[];
  published?: { "date-parts"?: number[][] };
  issued?: { "date-parts"?: number[][] };
  volume?: string;
  issue?: string;
  page?: string;
  "article-number"?: string;
  DOI?: string;
  URL?: string;
  ISSN?: string[];
  language?: string;
  publisher?: string;
}

function publishedDate(message: CrossrefMessage): string | undefined {
  const parts =
    message.published?.["date-parts"]?.[0] ||
    message.issued?.["date-parts"]?.[0];
  return parts?.filter(Boolean).join("-");
}

function stripMarkup(value?: string): string | undefined {
  return value
    ?.replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class CrossrefSource implements MetadataSource {
  readonly id = "crossref";

  canHandle(input: MetadataInput): boolean {
    return input.kind === "doi";
  }

  async fetch(
    input: MetadataInput,
    signal?: AbortSignal,
  ): Promise<MetadataCandidate[]> {
    if (!this.canHandle(input)) return [];
    let cancel: (() => void) | undefined;
    const abortListener = () => cancel?.();
    signal?.addEventListener("abort", abortListener, { once: true });
    try {
      const sourceUrl = `https://api.crossref.org/works/${encodeURIComponent(input.value)}`;
      const xhr = await Zotero.HTTP.request("GET", sourceUrl, {
        responseType: "json",
        timeout: 20000,
        errorDelayMax: 0,
        headers: {
          Accept: "application/json",
        },
        cancellerReceiver: (value: () => void) => {
          cancel = value;
        },
      });
      const payload =
        typeof xhr.response === "object"
          ? (xhr.response as { message: CrossrefMessage })
          : (JSON.parse(xhr.responseText || "{}") as {
              message: CrossrefMessage;
            });
      const message = payload.message;
      const creators: CreatorCandidate[] = (message.author || []).map(
        (author) => ({
          firstName: author.given,
          lastName: author.family,
          name: author.name,
          creatorType: "author",
        }),
      );
      const doi = message.DOI?.toLowerCase() || input.value;
      const publicationTitle = message["container-title"]?.[0]?.trim();
      const series = workingPaperSeries(
        doi,
        publicationTitle,
        message.publisher,
      );
      return [
        {
          sourceId: this.id,
          sourceLabel: "Crossref",
          sourceUrl,
          retrievedAt: new Date().toISOString(),
          itemType: mapCrossrefItemType(
            message.type,
            doi,
            publicationTitle,
            message.publisher,
          ),
          title: message.title?.[0]?.trim(),
          creators,
          abstractNote: stripMarkup(message.abstract),
          publicationTitle: series ? undefined : publicationTitle,
          date: publishedDate(message),
          volume: message.volume,
          issue: message.issue,
          pages: message.page || message["article-number"],
          DOI: doi,
          url: message.URL,
          ISSN: series ? undefined : message.ISSN,
          language: message.language,
          warnings: series
            ? [
                `${series} working paper detected; preserving the item as a preprint.`,
              ]
            : [],
        },
      ];
    } finally {
      signal?.removeEventListener("abort", abortListener);
    }
  }
}
