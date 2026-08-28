import { Hooks } from "./hooks";

declare const Zotero: any;
declare const _globalThis: any;

const globalScope: any = typeof _globalThis === "undefined" ? globalThis : _globalThis;
if (!Zotero.ZoteroWordbook) {
  const hooks = new Hooks();
  Zotero.ZoteroWordbook = { hooks };
  globalScope.Zotero = Zotero;
  void hooks.onStartup().catch((error: unknown) => Zotero.logError(error));
}
