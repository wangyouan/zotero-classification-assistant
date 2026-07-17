import { metadataRepairService } from "../metadata/metadataRepairService.js";
import {
  readCurrentMetadata,
  isEligibleBibliographicItem,
} from "../zotero/itemRepository.js";
import { recommendForItem } from "../recommendation/recommendationService.js";
import type {
  ClassificationRecommendation,
  Confidence,
} from "../recommendation/types.js";
import { getPref } from "../utils/prefs.js";
import {
  providerConfig,
  recommendationSettings,
} from "../storage/settingsStore.js";
import { OpenAICompatibleProvider } from "../providers/openAICompatibleProvider.js";
import {
  applyClassification,
  applyMetadataChanges,
  undoLastOperation,
} from "../zotero/transactions.js";
import { operationLog } from "../storage/operationLog.js";
import { reviewMetadataProposal } from "./metadataRepairDialog.js";

interface PaneState {
  loading?: string;
  error?: string;
  success?: string;
  recommendation?: ClassificationRecommendation;
}

const states = new Map<number, PaneState>();
let registeredPaneID: string | null = null;

function languageIsChinese(): boolean {
  return String(Zotero.locale || "")
    .toLowerCase()
    .startsWith("zh");
}

function text(en: string, zh: string): string {
  return languageIsChinese() ? zh : en;
}

function button(
  doc: Document,
  label: string,
  action: () => void,
): HTMLButtonElement {
  const element = doc.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.className = "zca-button";
  element.addEventListener("click", action);
  return element;
}

function heading(doc: Document, label: string): HTMLElement {
  const element = doc.createElement("h4");
  element.textContent = label;
  element.className = "zca-heading";
  return element;
}

function confidenceLabel(confidence: Confidence): string {
  return text(
    confidence === "high" ? "High" : confidence === "medium" ? "Medium" : "Low",
    confidence === "high" ? "高" : confidence === "medium" ? "中" : "低",
  );
}

function metadataCompleteness(item: Zotero.Item): string {
  const metadata = readCurrentMetadata(item);
  const values = [
    metadata.title,
    metadata.creators?.length ? "yes" : "",
    metadata.date,
    metadata.publicationTitle,
    metadata.DOI || metadata.url,
    metadata.abstractNote,
  ];
  const complete = values.filter(Boolean).length;
  return `${complete}/${values.length}`;
}

function renderRecommendation(
  doc: Document,
  container: HTMLElement,
  recommendation: ClassificationRecommendation,
): void {
  container.appendChild(heading(doc, text("Collections", "集合建议")));
  if (!recommendation.collections.length) {
    const empty = doc.createElement("p");
    empty.textContent = text(
      "No eligible collection candidates.",
      "没有符合条件的集合候选。 ",
    );
    container.appendChild(empty);
  }
  recommendation.collections.forEach((candidate) => {
    const row = doc.createElement("label");
    row.className = "zca-candidate";
    const checkbox = doc.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = candidate.selected;
    checkbox.disabled = candidate.alreadyAssigned;
    checkbox.addEventListener("change", () => {
      candidate.selected = checkbox.checked;
    });
    const body = doc.createElement("span");
    const evidence = candidate.evidence.map((item) => item.title).join("; ");
    body.textContent = `${candidate.path} · ${confidenceLabel(candidate.confidence)}${
      candidate.alreadyAssigned ? text(" · already assigned", " · 已归入") : ""
    }${
      getPref("showExplanations") ? `\n${candidate.reason}` : ""
    }${evidence ? `\n${text("Evidence", "依据")}: ${evidence}` : ""}`;
    row.append(checkbox, body);
    container.appendChild(row);
  });

  container.appendChild(heading(doc, text("Tags", "标签建议")));
  if (!recommendation.tags.length) {
    const empty = doc.createElement("p");
    empty.textContent = text(
      "No eligible manual tag candidates.",
      "没有符合条件的手动标签候选。 ",
    );
    container.appendChild(empty);
  }
  recommendation.tags.forEach((candidate) => {
    const row = doc.createElement("label");
    row.className = "zca-candidate";
    const checkbox = doc.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = candidate.selected;
    checkbox.disabled =
      candidate.alreadyAssigned || candidate.tagType === "automatic";
    checkbox.addEventListener("change", () => {
      candidate.selected = checkbox.checked;
    });
    const body = doc.createElement("span");
    body.textContent = `${candidate.tag} · ${confidenceLabel(candidate.confidence)} · ${
      candidate.tagType === "manual"
        ? text("manual", "手动")
        : text("automatic", "自动")
    }${candidate.alreadyAssigned ? text(" · already assigned", " · 已存在") : ""}${
      getPref("showExplanations") ? `\n${candidate.reason}` : ""
    }`;
    row.append(checkbox, body);
    container.appendChild(row);
  });

  container.appendChild(
    heading(doc, text("Similar local papers", "相似本地论文")),
  );
  const evidence = doc.createElement("ol");
  evidence.className = "zca-evidence";
  recommendation.similarItems.forEach((item) => {
    const entry = doc.createElement("li");
    entry.textContent = `${item.title} (${item.score.toFixed(2)})`;
    evidence.appendChild(entry);
  });
  container.appendChild(evidence);
}

async function remoteRerank(
  item: Zotero.Item,
  recommendation: ClassificationRecommendation,
): Promise<void> {
  const metadata = readCurrentMetadata(item);
  const provider = new OpenAICompatibleProvider(providerConfig());
  const result = await provider.rerankClassification({
    item: {
      title: metadata.title || "",
      abstractNote: getPref("sendAbstract") ? metadata.abstractNote : undefined,
      creators: (metadata.creators || []).map((creator) =>
        `${creator.firstName || ""} ${creator.lastName || ""}`.trim(),
      ),
      date: metadata.date,
      publicationTitle: metadata.publicationTitle,
    },
    collections: recommendation.collections.map((candidate) => ({
      collectionKey: candidate.collectionKey,
      path: candidate.path,
      localScore: candidate.score,
    })),
    tags: recommendation.tags.map((candidate) => ({
      tag: candidate.tag,
      localScore: candidate.score,
    })),
    similarItems: recommendation.similarItems.map((candidate) => ({
      title: candidate.title,
    })),
  });
  const toConfidence = (value: number): Confidence =>
    value >= 0.68 ? "high" : value >= 0.38 ? "medium" : "low";
  for (const reranked of result.collections) {
    const candidate = recommendation.collections.find(
      (value) => value.collectionKey === reranked.collectionKey,
    );
    if (candidate) {
      candidate.score = reranked.confidence;
      candidate.confidence = toConfidence(reranked.confidence);
      candidate.reason = reranked.reason;
    }
  }
  for (const reranked of result.tags) {
    const candidate = recommendation.tags.find(
      (value) => value.tag === reranked.tag,
    );
    if (candidate) {
      candidate.score = reranked.confidence;
      candidate.confidence = toConfidence(reranked.confidence);
      candidate.reason = reranked.reason;
    }
  }
  recommendation.collections.sort((a, b) => b.score - a.score);
  recommendation.tags.sort((a, b) => b.score - a.score);
}

function renderPane(body: HTMLDivElement, item: Zotero.Item): void {
  body.replaceChildren();
  body.classList.add("zca-pane");
  if (!isEligibleBibliographicItem(item)) {
    body.textContent = text(
      "Select a top-level bibliographic item.",
      "请选择顶层文献条目。",
    );
    return;
  }
  const state = states.get(item.id) || {};
  states.set(item.id, state);
  const doc = body.ownerDocument!;
  const status = doc.createElement("p");
  status.className = "zca-status";
  status.textContent = `${text("Metadata completeness", "元数据完整度")}: ${metadataCompleteness(item)} · ${
    state.loading || state.error || state.success || text("Ready", "就绪")
  }`;
  if (state.error) status.classList.add("zca-error");
  body.appendChild(status);

  const actions = doc.createElement("div");
  actions.className = "zca-actions";
  actions.appendChild(
    button(doc, text("Recommend classification", "推荐分类"), () => {
      if (!getPref("enableLocalClassification")) {
        state.error = text(
          "Local classification is disabled in preferences.",
          "设置中已关闭本地分类。",
        );
        renderPane(body, item);
        return;
      }
      state.loading = text("Scanning local library…", "正在扫描本地文库……");
      state.error = undefined;
      state.success = undefined;
      renderPane(body, item);
      void recommendForItem(item, recommendationSettings())
        .then((recommendation) => {
          state.recommendation = recommendation;
          state.success = text(
            `Indexed ${recommendation.indexedItemCount} items.`,
            `已扫描 ${recommendation.indexedItemCount} 个条目。`,
          );
        })
        .catch((error) => {
          state.error = error instanceof Error ? error.message : String(error);
        })
        .finally(() => {
          state.loading = undefined;
          renderPane(body, item);
        });
    }),
  );
  actions.appendChild(
    button(doc, text("Repair metadata", "修复元数据"), () => {
      const input = Zotero.getMainWindow()?.prompt(
        text(
          "Enter a DOI, DOI URL, or publisher article URL:",
          "请输入 DOI、DOI URL 或出版社文章网址：",
        ),
        String(item.getField("DOI") || item.getField("url") || ""),
      );
      if (!input) return;
      state.loading = text("Retrieving metadata…", "正在获取元数据……");
      state.error = undefined;
      renderPane(body, item);
      void metadataRepairService
        .prepare(item, input)
        .then(async (proposal) => {
          const selected = await reviewMetadataProposal(proposal);
          if (selected?.length) {
            await applyMetadataChanges(item, proposal.candidate, selected);
            state.success = text("Metadata updated.", "元数据已更新。 ");
          }
        })
        .catch((error) => {
          state.error = error instanceof Error ? error.message : String(error);
        })
        .finally(() => {
          state.loading = undefined;
          renderPane(body, item);
        });
    }),
  );
  body.appendChild(actions);

  if (state.recommendation) {
    renderRecommendation(doc, body, state.recommendation);
    const writeActions = doc.createElement("div");
    writeActions.className = "zca-actions";
    writeActions.appendChild(
      button(doc, text("Apply selected", "应用所选"), () => {
        const confirmed = Zotero.getMainWindow()?.confirm(
          text(
            "Apply the selected existing collections and manual tags?",
            "是否应用所选的现有集合和手动标签？",
          ),
        );
        if (!confirmed || !state.recommendation) return;
        state.loading = text("Applying…", "正在应用……");
        renderPane(body, item);
        void applyClassification(item, state.recommendation)
          .then(() => {
            state.success = text("Classification applied.", "分类已应用。 ");
          })
          .catch((error) => {
            state.error =
              error instanceof Error ? error.message : String(error);
          })
          .finally(() => {
            state.loading = undefined;
            renderPane(body, item);
          });
      }),
    );
    if (getPref("remoteEnabled")) {
      writeActions.appendChild(
        button(doc, text("Remote rerank", "远程重排"), () => {
          if (!state.recommendation) return;
          state.loading = text(
            "Reranking allowed candidates…",
            "正在重排候选……",
          );
          renderPane(body, item);
          void remoteRerank(item, state.recommendation)
            .then(() => {
              state.success = text(
                "Remote reranking completed.",
                "远程重排已完成。 ",
              );
            })
            .catch((error) => {
              state.error =
                error instanceof Error ? error.message : String(error);
            })
            .finally(() => {
              state.loading = undefined;
              renderPane(body, item);
            });
        }),
      );
    }
    body.appendChild(writeActions);
  }

  if (operationLog.peek(item.id)) {
    body.appendChild(
      button(doc, text("Undo last operation", "撤销上次操作"), () => {
        void undoLastOperation(item)
          .then((undone) => {
            state.success = undone
              ? text("Last operation undone.", "上次操作已撤销。 ")
              : text("Nothing to undo.", "没有可撤销的操作。 ");
          })
          .catch((error) => {
            state.error =
              error instanceof Error ? error.message : String(error);
          })
          .finally(() => renderPane(body, item));
      }),
    );
  }
}

export function registerClassificationItemPane(): void {
  if (registeredPaneID) return;
  const registered = Zotero.ItemPaneManager.registerSection({
    paneID: "zotero-classification-assistant",
    pluginID: addon.data.config.addonID,
    header: {
      l10nID: `${addon.data.config.addonRef}-item-pane-header`,
      icon: "chrome://zotero/skin/16/universal/book.svg",
    },
    sidenav: {
      l10nID: `${addon.data.config.addonRef}-item-pane-sidenav`,
      icon: "chrome://zotero/skin/20/universal/book.svg",
    },
    onItemChange: ({ item, setEnabled }) => {
      setEnabled(isEligibleBibliographicItem(item));
    },
    onRender: ({ body, item }) => renderPane(body, item),
  });
  registeredPaneID = registered || null;
}

export function unregisterClassificationItemPane(): void {
  if (registeredPaneID) {
    Zotero.ItemPaneManager.unregisterSection(registeredPaneID);
    registeredPaneID = null;
  }
  states.clear();
}
