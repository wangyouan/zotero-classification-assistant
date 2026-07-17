import type { MetadataInput } from "./types.js";

const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/i;
const DOI_FROM_TEXT =
  /(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/[^\s?#]+)/i;
const UNSAFE_PROTOCOLS = new Set(["file:", "javascript:", "data:"]);

export function normalizeDOI(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(DOI_FROM_TEXT);
  if (!match) return null;
  const doi = match[1]
    .replace(/[),.;:'"\]}]+$/g, "")
    .trim()
    .toLowerCase();
  return DOI_PATTERN.test(doi) ? doi : null;
}

export function normalizeURL(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (UNSAFE_PROTOCOLS.has(parsed.protocol)) return null;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeMetadataInput(value: string): MetadataInput {
  const doi = normalizeDOI(value);
  if (doi) return { kind: "doi", value: doi };
  const url = normalizeURL(value);
  if (url) return { kind: "url", value: url };
  throw new Error("Enter a valid DOI, DOI URL, or http(s) article URL.");
}
