import { OpenAICompatibleProvider } from "../providers/openAICompatibleProvider.js";
import { providerConfig } from "../storage/settingsStore.js";
import { secretStore } from "../storage/secretStore.js";
import { scanLibrary } from "../indexing/libraryIndexer.js";

function element<T extends Element>(window: Window, id: string): T | null {
  return window.document.querySelector(`#${id}`) as T | null;
}

function setStatus(window: Window, value: string): void {
  const status = element<HTMLElement>(window, "zca-pref-status");
  if (status) status.textContent = value;
}

export function registerPrefsScripts(window: Window): void {
  addon.data.prefs = { window };
  element<HTMLButtonElement>(window, "zca-test-provider")?.addEventListener(
    "click",
    () => {
      setStatus(window, "Testing provider connection…");
      const provider = new OpenAICompatibleProvider(providerConfig());
      void provider.testConnection().then((result) => {
        setStatus(
          window,
          `${result.ok ? "Success" : "Failed"}: ${result.message} (${result.durationMs} ms)`,
        );
      });
    },
  );
  element<HTMLButtonElement>(window, "zca-clear-api-key")?.addEventListener(
    "click",
    () => {
      secretStore.clear();
      const input = element<HTMLInputElement>(window, "zca-api-key");
      if (input) input.value = "";
      setStatus(window, "API key cleared from Zotero preferences.");
    },
  );
  element<HTMLButtonElement>(window, "zca-rebuild-index")?.addEventListener(
    "click",
    () => {
      setStatus(window, "Scanning personal library…");
      void scanLibrary(Zotero.Libraries.userLibraryID)
        .then((items) => {
          setStatus(
            window,
            `Local scan completed: ${items.length} eligible bibliographic items.`,
          );
        })
        .catch((error) => {
          setStatus(
            window,
            error instanceof Error ? error.message : String(error),
          );
        });
    },
  );
}
