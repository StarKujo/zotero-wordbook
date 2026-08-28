export type TranslationStatus = "pending" | "ready" | "failed";

export interface SourceOccurrence {
  id: string;
  savedAt: string;
  libraryID?: number;
  attachmentItemID?: number;
  attachmentItemKey?: string;
  parentItemID?: number;
  parentItemKey?: string;
  title?: string;
  pageIndex?: number;
  pageLabel?: string;
}

export interface VocabularyEntry {
  id: string;
  term: string;
  normalizedTerm: string;
  sourceLanguage: "en";
  targetLanguage: "zh-CN";
  translation?: string;
  translationStatus: TranslationStatus;
  provider?: "translate-for-zotero" | "manual";
  lastErrorCode?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  occurrenceCount: number;
  sources: SourceOccurrence[];
}

export interface WordbookData {
  schemaVersion: 1;
  updatedAt: string;
  entries: VocabularyEntry[];
}

export interface SelectionContext {
  term: string;
  source: SourceOccurrence;
}

export function normalizeTerm(term: string): string {
  return term.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

/** Conservative plural-to-singular conversion for the final word of a term. */
export function singularizeTerm(term: string): string {
  const irregular: Record<string, string> = { analyses: "analysis", children: "child", criteria: "criterion", feet: "foot", geese: "goose", men: "man", mice: "mouse", people: "person", phenomena: "phenomenon", teeth: "tooth", women: "woman" };
  const uncountable = new Set(["advice", "data", "equipment", "fish", "information", "knowledge", "literature", "news", "research", "series", "sheep", "species"]);
  const match = term.trim().match(/^(.*\b)([A-Za-z]+)$/); if (!match) return term;
  const [ , prefix, word ] = match; const lower = word.toLocaleLowerCase("en-US");
  if (uncountable.has(lower) || lower.length < 4) return term;
  let singular = irregular[lower];
  if (!singular && /[^aeiou]ies$/.test(lower)) singular = `${lower.slice(0, -3)}y`;
  else if (!singular && /ves$/.test(lower)) singular = `${lower.slice(0, -3)}f`;
  else if (!singular && /(ches|shes|sses|xes|zes)$/.test(lower)) singular = lower.slice(0, -2);
  else if (!singular && /s$/.test(lower) && !/(ss|us|is)$/.test(lower)) singular = lower.slice(0, -1);
  if (!singular) return term;
  return `${prefix}${word[0] === word[0].toUpperCase() ? singular[0].toUpperCase() + singular.slice(1) : singular}`;
}

export function isValidSelection(term: string, maxLength: number): boolean {
  const normalized = term.trim();
  return normalized.length > 0 && normalized.length <= maxLength && /[A-Za-z]/.test(normalized);
}
