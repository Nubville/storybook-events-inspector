import type { EventCatalogEntry } from './types';

/**
 * Capture is complete by default — the inspector sees every custom event
 * with no catalog or filter required. `filter`/`extra` are an opt-in
 * *narrowing* on top of that complete stream, not a prerequisite for seeing
 * anything: empty filter means "everything", matching the inspector's own
 * default.
 */
export function matchesFilter(name: string, filter: readonly string[], extra: readonly string[]): boolean {
  if (filter.length === 0) return true;
  return filter.includes(name) || extra.includes(name);
}

/** name -> declaring tags, for the "shared" flag. `undefined` means undocumented. */
export function indexCatalog(catalog: readonly EventCatalogEntry[]): ReadonlyMap<string, readonly string[]> {
  return new Map(catalog.map((entry) => [entry.name, entry.tags]));
}
