var chromeHandle;
function install() {}
async function startup({ rootURI, resourceURI }) {
  await Zotero.initializationPromise;
  rootURI ||= resourceURI.spec;
  const svc = Cc["@mozilla.org/addons/addon-manager-startup;1"].getService(Ci.amIAddonManagerStartup);
  chromeHandle = svc.registerChrome(Services.io.newURI(rootURI + "manifest.json"), [["content", "zoterowordbook", rootURI + "chrome/content/"]]);
  const context = { rootURI, Zotero, Services, Cc, Ci, ChromeUtils }; context._globalThis = context;
  Services.scriptloader.loadSubScript(rootURI + "chrome/content/scripts/zoterowordbook.js", context);
}
async function onMainWindowLoad({ window }) { await Zotero.ZoteroWordbook?.hooks.onMainWindowLoad(window); }
async function onMainWindowUnload({ window }) { await Zotero.ZoteroWordbook?.hooks.onMainWindowUnload(window); }
async function shutdown(data, reason) { if (reason !== APP_SHUTDOWN) await Zotero.ZoteroWordbook?.hooks.onShutdown(); chromeHandle?.destruct(); chromeHandle = null; }
function uninstall() {}
