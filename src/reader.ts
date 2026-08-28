import { isValidSelection, type SelectionContext, type SourceOccurrence } from "./domain";
import { WordbookService } from "./service";

declare const Zotero: any;

export function registerReaderPopup(service: WordbookService): void {
  Zotero.Reader.registerEventListener("renderTextSelectionPopup", (event: any) => {
    const term = String(event.params?.annotation?.text ?? "").trim();
    const maxLength = Number(Zotero.Prefs.get("extensions.zotero.zoterowordbook.maxSelectionLength", true) ?? 200);
    if (!isValidSelection(term, maxLength)) return;
    const context = buildContext(event.reader, event.params?.annotation, term);
    const button = event.doc.createElement("button");
    button.className = "toolbar-button wide-button zoterowordbook-save";
    button.textContent = "保存到单词本";
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true; button.textContent = "保存中…";
      const result = await service.saveSelection(context);
      button.textContent = result.translated ? (result.duplicate ? "已存在，已记录来源" : "已保存到单词本") : "已保存，待补译";
      setTimeout(() => { if (button.isConnected) button.disabled = false; }, 900);
    });
    event.append(button);
  }, "zotero-wordbook@lyr.local");
}

function buildContext(reader: any, annotation: any, term: string): SelectionContext {
  const attachment = Zotero.Items.get(reader.itemID);
  const parent = attachment?.parentID ? Zotero.Items.get(attachment.parentID) : undefined;
  let pageIndex: number | undefined; let pageLabel: string | undefined;
  try {
    const position = typeof annotation?.position === "string" ? JSON.parse(annotation.position) : annotation?.position;
    pageIndex = Number.isInteger(position?.pageIndex) ? position.pageIndex : undefined;
    pageLabel = position?.pageLabel ?? annotation?.pageLabel;
  } catch { pageLabel = annotation?.pageLabel; }
  const source: SourceOccurrence = {
    id: `${Zotero.Utilities.randomString(12)}-${Date.now()}`, savedAt: new Date().toISOString(),
    libraryID: attachment?.libraryID, attachmentItemID: attachment?.id, attachmentItemKey: attachment?.key,
    parentItemID: parent?.id, parentItemKey: parent?.key, title: parent?.getField?.("title") || attachment?.getField?.("title"),
    pageIndex, pageLabel,
  };
  return { term, source };
}
