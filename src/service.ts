import type { SelectionContext } from "./domain";
import { WordbookRepository } from "./repository";

declare const Zotero: any;

export class WordbookService {
  private readonly operationTokens = new Map<string, string>();
  constructor(readonly repository: WordbookRepository) {}

  async saveSelection(context: SelectionContext): Promise<{ duplicate: boolean; translated: boolean }> {
    const { entry, needsTranslation } = await this.repository.upsertPending(context.term, context.source);
    if (!needsTranslation) return { duplicate: true, translated: true };
    const token = `${entry.id}-${Date.now()}`;
    this.operationTokens.set(entry.id, token);
    try {
      const translation = await withTimeout(this.translate(context.term, context.source.attachmentItemID), 30000);
      if (this.operationTokens.get(entry.id) !== token) return { duplicate: false, translated: false };
      await this.repository.completeTranslation(entry.id, translation);
      return { duplicate: false, translated: true };
    } catch (error) {
      if (this.operationTokens.get(entry.id) === token) {
        const message = error instanceof Error ? error.message : String(error);
        const code = message === "Translation timed out" ? "timeout" : message.includes("not installed") ? "provider-unavailable" : "service-failed";
        await this.repository.failTranslation(entry.id, code, message);
      }
      return { duplicate: false, translated: false };
    } finally { if (this.operationTokens.get(entry.id) === token) this.operationTokens.delete(entry.id); }
  }

  async retry(id: string): Promise<void> {
    const entry = this.repository.getEntries().find((item) => item.id === id);
    if (!entry) return;
    const source = entry.sources[0] ?? { id: "retry", savedAt: new Date().toISOString() };
    const token = `${entry.id}-retry-${Date.now()}`;
    this.operationTokens.set(entry.id, token);
    try {
      const translation = await withTimeout(this.translate(entry.term, source.attachmentItemID), 30000);
      if (this.operationTokens.get(entry.id) === token) await this.repository.completeTranslation(entry.id, translation);
    } catch (error) {
      if (this.operationTokens.get(entry.id) === token) {
        const message = error instanceof Error ? error.message : String(error);
        await this.repository.failTranslation(entry.id, message === "Translation timed out" ? "timeout" : "service-failed", message);
      }
    } finally { if (this.operationTokens.get(entry.id) === token) this.operationTokens.delete(entry.id); }
  }

  private async translate(term: string, itemID?: number): Promise<string> {
    const api = Zotero.PDFTranslate?.api;
    if (typeof api?.translate !== "function") throw new Error("Translate for Zotero is not installed or enabled");
    const task = await api.translate(term, {
      pluginID: "zotero-wordbook@lyr.local", itemID, langfrom: "en", langto: "zh-CN",
    });
    if (task?.status !== "success" || !String(task.result ?? "").trim()) throw new Error("Translation service did not return a result");
    return String(task.result).trim();
  }
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Translation timed out")), milliseconds);
    promise.then((result) => { clearTimeout(timer); resolve(result); }, (error) => { clearTimeout(timer); reject(error); });
  });
}
