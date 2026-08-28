import { config } from "./config";
import { normalizeTerm, singularizeTerm, type SourceOccurrence, type VocabularyEntry, type WordbookData } from "./domain";

declare const IOUtils: any;
declare const PathUtils: any;
declare const Zotero: any;

// Zotero's bundled JavaScript runtime may not expose structuredClone.
function clone<T>(value: T): T {
  if (value === undefined || value === null || typeof value !== "object") return value;
  const nativeClone = (globalThis as { structuredClone?: (input: T) => T }).structuredClone;
  return typeof nativeClone === "function"
    ? nativeClone(value)
    : JSON.parse(JSON.stringify(value)) as T;
}

const emptyData = (): WordbookData => ({
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  entries: [],
});

export class WordbookRepository {
  private data: WordbookData = emptyData();
  private writeChain: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<() => void>();
  private readonly directoryPath: string;
  private readonly filePath: string;
  private readonly backupPath: string;

  constructor() {
    const dataDirectory = String(Zotero.DataDirectory.dir);
    this.directoryPath = PathUtils.join(dataDirectory, config.dataDirectoryName);
    this.filePath = PathUtils.join(this.directoryPath, config.dataFileName);
    this.backupPath = `${this.filePath}.bak`;
  }

  async initialize(): Promise<void> {
    await IOUtils.makeDirectory(this.directoryPath, { ignoreExisting: true });
    this.data = await this.readExisting();
    let changed = false;
    for (const entry of this.data.entries) {
      if (entry.translationStatus === "pending") {
        entry.translationStatus = "failed";
        entry.lastErrorCode = "interrupted";
        entry.lastError = "上次翻译被中断，可重试";
        entry.updatedAt = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) await this.persist(this.data);
  }

  getEntries(): VocabularyEntry[] {
    return clone(this.data.entries);
  }

  getDataPath(): string {
    return this.filePath;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async upsertPending(term: string, source: SourceOccurrence): Promise<{ entry: VocabularyEntry; needsTranslation: boolean }> {
    term = singularizeTerm(term);
    const normalizedTerm = normalizeTerm(term);
    return this.mutate((draft) => {
      const existing = draft.entries.find((entry) => entry.normalizedTerm === normalizedTerm);
      if (existing) {
        existing.occurrenceCount += 1;
        existing.updatedAt = new Date().toISOString();
        if (!existing.sources.some((item) => sameSource(item, source))) existing.sources.push(source);
        return { entry: existing, needsTranslation: existing.translationStatus !== "ready" || !existing.translation };
      }
      const now = new Date().toISOString();
      const entry: VocabularyEntry = {
        id: randomID(), term, normalizedTerm, sourceLanguage: "en", targetLanguage: "zh-CN",
        translationStatus: "pending", createdAt: now, updatedAt: now, occurrenceCount: 1, sources: [source],
      };
      draft.entries.unshift(entry);
      return { entry, needsTranslation: true };
    });
  }

  async completeTranslation(id: string, translation: string): Promise<void> {
    await this.mutate((draft) => {
      const entry = findEntry(draft, id);
      entry.translation = translation.trim(); entry.translationStatus = "ready";
      entry.provider = "translate-for-zotero"; entry.lastError = undefined; entry.lastErrorCode = undefined;
      entry.updatedAt = new Date().toISOString();
    });
  }

  async failTranslation(id: string, code: string, message: string): Promise<void> {
    await this.mutate((draft) => {
      const entry = findEntry(draft, id);
      if (entry.translationStatus === "ready" && entry.provider === "manual") return;
      entry.translationStatus = "failed"; entry.lastErrorCode = code; entry.lastError = message;
      entry.updatedAt = new Date().toISOString();
    });
  }

  async updateTranslation(id: string, translation: string): Promise<void> {
    await this.mutate((draft) => {
      const entry = findEntry(draft, id);
      entry.translation = translation.trim(); entry.translationStatus = "ready"; entry.provider = "manual";
      entry.lastError = undefined; entry.lastErrorCode = undefined; entry.updatedAt = new Date().toISOString();
    });
  }

  async deleteEntry(id: string): Promise<void> {
    await this.mutate((draft) => { draft.entries = draft.entries.filter((entry) => entry.id !== id); });
  }

  async exportJSON(): Promise<string> { return JSON.stringify(this.data, null, 2); }

  async exportCSV(): Promise<string> {
    const esc = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = ["English,Chinese,PaperTitle,Page,CreatedAt,OccurrenceCount"];
    for (const entry of this.data.entries) {
      const source = entry.sources[0];
      rows.push([entry.term, entry.translation ?? "", source?.title ?? "", source?.pageLabel ?? "", entry.createdAt, entry.occurrenceCount].map(esc).join(","));
    }
    return `\uFEFF${rows.join("\r\n")}`;
  }

  private async mutate<T>(mutation: (draft: WordbookData) => T): Promise<T> {
    let result!: T;
    this.writeChain = this.writeChain.then(async () => {
      const draft = clone(this.data) as WordbookData;
      result = mutation(draft);
      draft.updatedAt = new Date().toISOString();
      await this.persist(draft);
      this.data = draft;
      this.listeners.forEach((listener) => listener());
    });
    await this.writeChain;
      return clone(result);
  }

  private async readExisting(): Promise<WordbookData> {
    let sawFile = false;
    for (const path of [this.filePath, this.backupPath]) {
      try {
        if (!(await IOUtils.exists(path))) continue;
        sawFile = true;
        const value = await IOUtils.readJSON(path);
        if (value?.schemaVersion !== 1 || !Array.isArray(value.entries)) throw new Error("Unsupported wordbook schema");
        return value as WordbookData;
      } catch (error) { Zotero.logError(error); }
    }
    if (sawFile) throw new Error("Wordbook data is corrupted or uses an unsupported schema");
    return emptyData();
  }

  private async persist(data: WordbookData): Promise<void> {
    const tempPath = `${this.filePath}.tmp`;
    await IOUtils.writeJSON(tempPath, data, { flush: true });
    if (await IOUtils.exists(this.filePath)) await IOUtils.copy(this.filePath, this.backupPath);
    await IOUtils.move(tempPath, this.filePath, { noOverwrite: false });
  }
}

function findEntry(data: WordbookData, id: string): VocabularyEntry {
  const entry = data.entries.find((item) => item.id === id);
  if (!entry) throw new Error("Wordbook entry does not exist");
  return entry;
}
function randomID(): string { return `${Zotero.Utilities.randomString(12)}-${Date.now()}`; }
function sameSource(a: SourceOccurrence, b: SourceOccurrence): boolean {
  const key = (source: SourceOccurrence) => `${source.libraryID ?? ""}|${source.attachmentItemKey ?? source.attachmentItemID ?? ""}|${source.pageIndex ?? source.pageLabel ?? ""}`;
  return Boolean(a.libraryID && (a.attachmentItemKey || a.attachmentItemID) && key(a) === key(b));
}
