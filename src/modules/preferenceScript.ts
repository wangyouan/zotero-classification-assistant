import { OpenAICompatibleProvider } from "../providers/openAICompatibleProvider.js";
import { providerConfig } from "../storage/settingsStore.js";
import { secretStore } from "../storage/secretStore.js";
import { scanLibrary } from "../indexing/libraryIndexer.js";
import { getPref } from "../utils/prefs.js";
import { semanticIndexService } from "../semantic/semanticIndex.js";
import {
  semanticModelService,
  type SemanticProgress,
} from "../semantic/semanticModel.js";

function element<T extends Element>(window: Window, id: string): T | null {
  return window.document.querySelector(`#${id}`) as T | null;
}

function setStatus(window: Window, value: string): void {
  const status = element<HTMLElement>(window, "zca-pref-status");
  if (status) status.textContent = value;
}

function setSemanticStatus(window: Window, value: string): void {
  const status = element<HTMLElement>(window, "zca-semantic-status");
  if (status) status.textContent = value;
}

function progressText(progress: SemanticProgress): string {
  if (progress.phase === "index") {
    return `Building semantic index: ${progress.completed || 0}/${progress.itemCount || 0}`;
  }
  if (progress.total && typeof progress.loaded === "number") {
    return `Downloading local model: ${Math.round((progress.loaded / progress.total) * 100)}% (${progress.file || "model file"})`;
  }
  return `Loading local model: ${progress.file || progress.status}`;
}

async function refreshSemanticStatus(window: Window): Promise<void> {
  const [bytes, entries] = await Promise.all([
    semanticModelService.cacheSize(),
    semanticIndexService.entryCount(Zotero.Libraries.userLibraryID),
  ]);
  setSemanticStatus(
    window,
    `Local model cache: ${(bytes / 1024 / 1024).toFixed(1)} MB; semantic index: ${entries} items.`,
  );
}

export function registerPrefsScripts(window: Window): void {
  addon.data.prefs = { window };
  void refreshSemanticStatus(window);
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
  element<HTMLButtonElement>(window, "zca-test-semantic")?.addEventListener(
    "click",
    () => {
      setSemanticStatus(window, "Preparing local multilingual model…");
      void semanticModelService
        .test((progress) => setSemanticStatus(window, progressText(progress)))
        .then(async (similarity) => {
          await refreshSemanticStatus(window);
          setSemanticStatus(
            window,
            `Local model ready. Chinese/English probe similarity: ${similarity.toFixed(3)}.`,
          );
        })
        .catch((error) => {
          setSemanticStatus(
            window,
            `Local model failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    },
  );
  element<HTMLButtonElement>(
    window,
    "zca-build-semantic-index",
  )?.addEventListener("click", () => {
    setSemanticStatus(window, "Building semantic index…");
    void semanticIndexService
      .rebuild(
        Zotero.Libraries.userLibraryID,
        Boolean(getPref("includeAbstracts")),
        (progress) => setSemanticStatus(window, progressText(progress)),
      )
      .then(async (count) => {
        await refreshSemanticStatus(window);
        setSemanticStatus(window, `Semantic index ready: ${count} items.`);
      })
      .catch((error) => {
        setSemanticStatus(
          window,
          `Semantic indexing failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  });
  element<HTMLButtonElement>(window, "zca-clear-semantic")?.addEventListener(
    "click",
    () => {
      const confirmed = window.confirm(
        "Delete the downloaded semantic model and local semantic index?",
      );
      if (!confirmed) return;
      setSemanticStatus(window, "Deleting semantic model and index…");
      void Promise.all([
        semanticModelService.clear(),
        semanticIndexService.clear(),
      ])
        .then(() => refreshSemanticStatus(window))
        .catch((error) => {
          setSemanticStatus(
            window,
            `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    },
  );
}
