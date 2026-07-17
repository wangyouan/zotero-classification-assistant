import { getPref, setPref } from "../utils/prefs.js";
import type { ProviderConfig } from "../providers/types.js";

export function recommendationSettings() {
  return {
    maxCollections: Math.max(
      1,
      Number(getPref("maxCollectionRecommendations")) || 3,
    ),
    maxTags: Math.max(1, Number(getPref("maxTagRecommendations")) || 6),
    includeAutomaticTags: Boolean(getPref("includeAutomaticTags")),
    includeAbstracts: Boolean(getPref("includeAbstracts")),
    semanticEnabled: Boolean(getPref("semanticEnabled")),
    excludedCollectionPaths: String(getPref("excludedCollectionPaths") || "")
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

export function providerConfig(): ProviderConfig {
  return {
    displayName: String(getPref("providerName") || "OpenAI-compatible"),
    baseURL: String(getPref("baseURL") || ""),
    apiKey: String(getPref("apiKey") || ""),
    model: String(getPref("model") || ""),
    timeoutMs: Math.max(1000, Number(getPref("timeoutMs")) || 30000),
    temperature: Number.parseFloat(String(getPref("temperature") || "0.2")),
    maxOutputTokens: Math.max(1, Number(getPref("maxOutputTokens")) || 800),
  };
}

export function setApiKey(value: string): void {
  setPref("apiKey", value);
}
