import type { VocabularyEntry } from "./domain";
import { WordbookService } from "./service";

declare const Zotero: any;

export function registerWordbookPanel(service: WordbookService): void {
  const refreshers = new Set<() => void>();
  const bodyRefreshers = new WeakMap<object, () => void>();
  service.repository.subscribe(() => refreshers.forEach((refresh) => refresh()));
  Zotero.ItemPaneManager.registerSection({
    paneID: "zoterowordbook-wordbook", pluginID: "zotero-wordbook@lyr.local",
    header: { l10nID: "zoterowordbook-section-title", icon: "chrome://zoterowordbook/content/icons/wordbook.svg" },
    sidenav: { l10nID: "zoterowordbook-section-sidenav", icon: "chrome://zoterowordbook/content/icons/wordbook.svg" },
    onInit: ({ body }: any) => { body.dataset.zoterowordbookQuery = ""; },
    onItemChange: ({ tabType, setEnabled }: any) => { setEnabled(tabType === "reader"); return true; },
    onRender: ({ body, item }: any) => {
      const render = () => renderPanel(body, item, service);
      refreshers.add(render); bodyRefreshers.set(body, render); render();
    },
    onDestroy: ({ body }: any) => { const render = bodyRefreshers.get(body); if (render) refreshers.delete(render); bodyRefreshers.delete(body); },
  });
}

function renderPanel(body: HTMLElement, item: any, service: WordbookService): void {
  const doc = body.ownerDocument;
  const query = body.dataset.zoterowordbookQuery ?? "";
  const currentOnly = body.dataset.zoterowordbookCurrent === "true";
  const parent = item?.parentID ? Zotero.Items.get(item.parentID) : undefined;
  const parentKey = parent?.key ?? item?.parentKey ?? item?.key;
  const entries = service.repository.getEntries().filter((entry) => matches(entry, query, currentOnly ? parentKey : undefined));
  const root = doc.createElement("div"); root.className = "zoterowordbook-panel";
  const searchLabel = doc.createElement("label"); searchLabel.className = "zoterowordbook-search"; searchLabel.title = "按英文单词或中文释义筛选";
  const searchIcon = doc.createElement("span"); searchIcon.textContent = "🔎"; searchIcon.setAttribute("aria-hidden", "true");
  const search = doc.createElement("input"); search.type = "search"; search.placeholder = "搜索英文或中文"; search.title = "搜索英文单词或中文释义"; search.value = query;
  let composing = false;
  search.addEventListener("compositionstart", () => { composing = true; });
  search.addEventListener("compositionend", () => { composing = false; search.dispatchEvent(new doc.defaultView!.Event("input", { bubbles: true })); });
  search.addEventListener("input", () => {
    if (composing) return;
    const value = search.value; const start = search.selectionStart ?? value.length; const end = search.selectionEnd ?? start;
    body.dataset.zoterowordbookQuery = value; renderPanel(body, item, service);
    const next = body.querySelector<HTMLInputElement>("input[type=search]");
    next?.focus(); next?.setSelectionRange(start, end);
  });
  searchLabel.append(searchIcon, search);
  const filter = doc.createElement("button"); filter.textContent = currentOnly ? "📄 仅检索当前论文" : "📚 检索全部论文"; filter.title = currentOnly ? "当前仅检索正在阅读的论文；点击后检索全部论文" : "当前检索全部论文；点击后仅检索正在阅读的论文"; filter.setAttribute("aria-label", filter.title);
  filter.addEventListener("click", () => { body.dataset.zoterowordbookCurrent = String(!currentOnly); renderPanel(body, item, service); });
  const stat = doc.createElement("p"); stat.textContent = `${entries.length} 个词条`;
  stat.title = "当前筛选条件下的词条数量";
  root.append(searchLabel, filter, stat);
  for (const entry of entries.slice(0, 100)) root.append(renderEntry(doc, entry, service));
  if (!entries.length) { const empty = doc.createElement("p"); empty.textContent = "还没有词条。选中文本后点击“保存到单词本”。"; root.append(empty); }
  body.replaceChildren(root);
}

function matches(entry: VocabularyEntry, query: string, parentKey?: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (q && !`${entry.term} ${entry.translation ?? ""}`.toLocaleLowerCase().includes(q)) return false;
  return !parentKey || entry.sources.some((source) => source.parentItemKey === parentKey || source.attachmentItemKey === parentKey);
}

function renderEntry(doc: Document, entry: VocabularyEntry, service: WordbookService): HTMLElement {
  const row = doc.createElement("div"); row.className = "zoterowordbook-entry";
  const label = doc.createElement("strong"); label.textContent = entry.term;
  const translation = doc.createElement("span"); translation.className = "zoterowordbook-translation"; translation.textContent = entry.translation ?? "（待补译）";
  const edit = doc.createElement("button"); edit.textContent = "✎ 编辑"; edit.title = "修改这条词的中文释义"; edit.setAttribute("aria-label", edit.title);
  edit.addEventListener("click", async () => { const value = doc.defaultView?.prompt("中文释义", entry.translation ?? ""); if (value?.trim()) await service.repository.updateTranslation(entry.id, value); });
  const retry = doc.createElement("button"); retry.textContent = "↻ 重试翻译"; retry.title = "翻译失败或尚未翻译时重新调用翻译服务"; retry.setAttribute("aria-label", retry.title); retry.hidden = entry.translationStatus === "ready";
  retry.addEventListener("click", () => void service.retry(entry.id));
  const remove = doc.createElement("button"); remove.textContent = "🗑 删除"; remove.title = "从单词本中删除这条词（不会删除原论文）"; remove.setAttribute("aria-label", remove.title);
  remove.addEventListener("click", async () => { if (doc.defaultView?.confirm(`删除“${entry.term}”吗？`)) await service.repository.deleteEntry(entry.id); });
  row.append(label, translation, edit, retry, remove); return row;
}
