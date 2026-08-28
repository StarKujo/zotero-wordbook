import { registerWordbookPanel } from "./panel";
import { registerReaderPopup } from "./reader";
import { WordbookRepository } from "./repository";
import { WordbookService } from "./service";

declare const Zotero: any;
declare const IOUtils: any;
declare const PathUtils: any;

export class Hooks {
  private repository?: WordbookRepository;
  private service?: WordbookService;
  private started = false;

  async onStartup(): Promise<void> {
    if (this.started) return;
    await Promise.all([Zotero.initializationPromise, Zotero.unlockPromise, Zotero.uiReadyPromise]);
    this.repository = new WordbookRepository(); await this.repository.initialize();
    this.service = new WordbookService(this.repository);
    registerReaderPopup(this.service); registerWordbookPanel(this.service); this.registerExportMenu(this.repository);
    this.started = true;
    for (const window of Zotero.getMainWindows()) await this.onMainWindowLoad(window);
  }

  private registerExportMenu(repository: WordbookRepository): void {
    if (!Zotero.MenuManager?.registerMenu) return;
    Zotero.MenuManager.registerMenu({
      menuID: "zoterowordbook-export", pluginID: "zotero-wordbook@lyr.local",
      target: "main/menubar/tools",
      menus: [
        { menuType: "menuitem", l10nID: "zoterowordbook-export-json", onCommand: async () => IOUtils.writeUTF8(PathUtils.join(String(Zotero.DataDirectory.dir), "zotero-wordbook", "wordbook-export.json"), await repository.exportJSON(), { flush: true }) },
        { menuType: "menuitem", l10nID: "zoterowordbook-export-csv", onCommand: async () => IOUtils.writeUTF8(PathUtils.join(String(Zotero.DataDirectory.dir), "zotero-wordbook", "wordbook-export.csv"), await repository.exportCSV(), { flush: true }) },
      ],
    });
  }

  async onMainWindowLoad(window: Window): Promise<void> {
    const doc = window.document;
    window.MozXULElement?.insertFTLIfNeeded?.("zoterowordbook-mainWindow.ftl");
    if (!doc.getElementById("zoterowordbook-style")) {
      const style = doc.createElement("style"); style.id = "zoterowordbook-style";
      style.textContent = ".zoterowordbook-panel{padding:8px;display:grid;gap:8px}.zoterowordbook-entry{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid var(--fill-quinary)}.zoterowordbook-entry span{flex:1;min-width:120px;margin-left:8px}.zoterowordbook-entry button{opacity:0;transition:opacity .15s}.zoterowordbook-entry:hover button,.zoterowordbook-entry button:focus{opacity:1}";
      doc.documentElement.append(style);
    }
  }

  async onMainWindowUnload(window: Window): Promise<void> {
    window.document.getElementById("zoterowordbook-style")?.remove();
    window.document.querySelector('[href="zoterowordbook.ftl"]')?.remove();
  }

  async onShutdown(): Promise<void> {
    for (const window of Zotero.getMainWindows()) await this.onMainWindowUnload(window);
    this.started = false; this.service = undefined; this.repository = undefined;
    delete Zotero.ZoteroWordbook;
  }
}
