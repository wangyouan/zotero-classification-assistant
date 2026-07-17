import { compareMetadata } from "./metadataComparator.js";
import { normalizeMetadataInput } from "./identifierNormalizer.js";
import { CrossrefSource } from "./sources/crossrefSource.js";
import type {
  MetadataCandidate,
  MetadataFieldComparison,
  MetadataSource,
} from "./types.js";
import {
  findOtherItemWithDOI,
  readCurrentMetadata,
} from "../zotero/itemRepository.js";

export interface MetadataRepairProposal {
  candidate: MetadataCandidate;
  comparisons: MetadataFieldComparison[];
  warnings: string[];
}

export class MetadataRepairService {
  constructor(
    private readonly sources: MetadataSource[] = [new CrossrefSource()],
  ) {}

  async prepare(
    item: Zotero.Item,
    rawInput: string,
    signal?: AbortSignal,
  ): Promise<MetadataRepairProposal> {
    const input = normalizeMetadataInput(rawInput);
    const sources = this.sources.filter((source) => source.canHandle(input));
    if (!sources.length) {
      throw new Error(
        input.kind === "url"
          ? "Publisher webpage translation is not yet available in this prototype. Use a DOI or DOI URL."
          : "No metadata source can handle this identifier.",
      );
    }
    const results = await Promise.all(
      sources.map((source) => source.fetch(input, signal)),
    );
    const candidate = results.flat()[0];
    if (!candidate) throw new Error("No metadata candidate was returned.");
    const warnings = [...candidate.warnings];
    if (candidate.DOI) {
      const duplicate = await findOtherItemWithDOI(
        item.libraryID,
        candidate.DOI,
        item.id,
      );
      if (duplicate) {
        warnings.push(
          `DOI already exists on another item: ${duplicate.getDisplayTitle()}`,
        );
      }
    }
    const comparisons = compareMetadata(readCurrentMetadata(item), candidate);
    warnings.push(
      ...comparisons
        .filter((comparison) => comparison.warning)
        .map((comparison) => comparison.warning as string),
    );
    return { candidate, comparisons, warnings: [...new Set(warnings)] };
  }
}

export const metadataRepairService = new MetadataRepairService();
