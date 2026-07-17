import { clearPref, getPref, setPref } from "../utils/prefs.js";

export interface SecretStore {
  get(): string;
  set(value: string): void;
  clear(): void;
}

export class ZoteroPreferenceSecretStore implements SecretStore {
  get(): string {
    return String(getPref("apiKey") || "");
  }

  set(value: string): void {
    setPref("apiKey", value.trim());
  }

  clear(): void {
    clearPref("apiKey");
  }
}

export const secretStore = new ZoteroPreferenceSecretStore();
