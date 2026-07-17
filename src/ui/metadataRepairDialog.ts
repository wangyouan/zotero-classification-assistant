import type {
  ComparableMetadataField,
  MetadataFieldComparison,
} from "../metadata/types.js";
import type { MetadataRepairProposal } from "../metadata/metadataRepairService.js";

const FIELD_LABELS: Record<ComparableMetadataField, string> = {
  itemType: "Item type",
  title: "Title",
  creators: "Creators",
  abstractNote: "Abstract",
  publicationTitle: "Publication",
  date: "Date",
  volume: "Volume",
  issue: "Issue",
  pages: "Pages / article number",
  DOI: "DOI",
  url: "URL",
  ISSN: "ISSN",
  language: "Language",
};

function comparisonText(comparison: MetadataFieldComparison): string {
  const current = comparison.currentValue || "(empty)";
  const candidate = comparison.candidateValue || "(empty)";
  return `${FIELD_LABELS[comparison.field]}\nCurrent: ${current}\nCandidate: ${candidate}${
    comparison.warning ? `\nWarning: ${comparison.warning}` : ""
  }`;
}

export async function reviewMetadataProposal(
  proposal: MetadataRepairProposal,
): Promise<ComparableMetadataField[] | null> {
  const changed = proposal.comparisons.filter(
    (comparison) => comparison.changed && comparison.candidateValue,
  );
  if (!changed.length) {
    ztoolkit.getGlobal("alert")("No metadata differences were found.");
    return null;
  }
  const dialogData: Record<string, unknown> = {};
  changed.forEach((comparison) => {
    dialogData[`field_${comparison.field}`] = comparison.defaultSelected;
  });
  const dialog = new ztoolkit.Dialog(changed.length + 3, 2)
    .addCell(0, 0, {
      tag: "h2",
      namespace: "html",
      properties: { textContent: "Review metadata changes" },
    })
    .addCell(1, 0, {
      tag: "div",
      namespace: "html",
      properties: {
        textContent: proposal.warnings.length
          ? `Warnings: ${proposal.warnings.join(" | ")}`
          : `Source: ${proposal.candidate.sourceLabel}`,
      },
      styles: {
        color: proposal.warnings.length ? "#9a3412" : "inherit",
        maxWidth: "720px",
        whiteSpace: "normal",
        marginBottom: "8px",
      },
    });

  changed.forEach((comparison, index) => {
    dialog
      .addCell(index + 2, 0, {
        tag: "input",
        namespace: "html",
        id: `metadata-${comparison.field}`,
        attributes: {
          type: "checkbox",
          "data-bind": `field_${comparison.field}`,
          "data-prop": "checked",
        },
      })
      .addCell(index + 2, 1, {
        tag: "label",
        namespace: "html",
        attributes: { for: `metadata-${comparison.field}` },
        properties: { textContent: comparisonText(comparison) },
        styles: {
          whiteSpace: "pre-wrap",
          maxWidth: "680px",
          marginBottom: "8px",
        },
      });
  });

  dialog
    .addButton("Select recommended fields", "select-all", {
      noClose: true,
      callback: () => {
        for (const comparison of changed) {
          dialogData[`field_${comparison.field}`] = comparison.defaultSelected;
          const checkbox = dialog.window.document.querySelector(
            `#metadata-${comparison.field}`,
          ) as HTMLInputElement | null;
          if (checkbox) checkbox.checked = comparison.defaultSelected;
        }
      },
    })
    .addButton("Apply selected fields", "apply")
    .addButton("Cancel", "cancel")
    .setDialogData(dialogData)
    .open("Zotero Classification Assistant", {
      width: 820,
      height: 680,
      resizable: true,
      fitContent: false,
      centerscreen: true,
    });
  addon.data.dialog = dialog;
  await (dialogData.unloadLock as { promise: Promise<void> }).promise;
  addon.data.dialog = undefined;
  if (dialogData._lastButtonId !== "apply") return null;
  return changed
    .filter((comparison) => Boolean(dialogData[`field_${comparison.field}`]))
    .map((comparison) => comparison.field);
}
