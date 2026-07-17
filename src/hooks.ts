import { initLocale, getString } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";
import {
  registerClassificationItemPane,
  unregisterClassificationItemPane,
} from "./ui/itemPane";
import { operationLog } from "./storage/operationLog";

function registerPreferences(): void {
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: rootURI + "content/preferences.xhtml",
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
  });
}

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);
  initLocale();
  registerPreferences();
  registerClassificationItemPane();
  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );
  addon.data.initialized = true;
  ztoolkit.log("Zotero Classification Assistant initialized");
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  addon.data.ztoolkit = createZToolkit();
  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );
  if (
    !win.document.getElementById(`${addon.data.config.addonRef}-stylesheet`)
  ) {
    const stylesheet = ztoolkit.UI.createElement(win.document, "link", {
      id: `${addon.data.config.addonRef}-stylesheet`,
      properties: {
        type: "text/css",
        rel: "stylesheet",
        href: `chrome://${addon.data.config.addonRef}/content/zoteroPane.css`,
      },
    });
    win.document.documentElement?.appendChild(stylesheet);
  }
}

async function onMainWindowUnload(win: Window): Promise<void> {
  win.document
    .getElementById(`${addon.data.config.addonRef}-stylesheet`)
    ?.remove();
  addon.data.dialog?.window?.close();
}

function onShutdown(): void {
  unregisterClassificationItemPane();
  operationLog.clear();
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  if (type === "load") registerPrefsScripts(data.window);
}

// Kept as inert compatibility hooks for the scaffold's unregistered examples.
async function onNotify(..._args: unknown[]) {}
function onShortcuts(..._args: unknown[]) {}
function onDialogEvents(..._args: unknown[]) {}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onPrefsEvent,
  onNotify,
  onShortcuts,
  onDialogEvents,
};
