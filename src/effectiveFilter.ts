import type { EventsInspectorParameters } from './types';

/**
 * Resolves what `filter` actually is for a given `eventsInspector` parameter
 * set. An explicit `filter` always wins; otherwise `catalogOnly` derives one
 * from the catalog's own names. Shared by the preview decorator (what to
 * forward) and the panel (what to say in the header/empty state) so the two
 * can't disagree about what "narrowed" means.
 */
export function effectiveFilter(params: EventsInspectorParameters): string[] {
  const filter = params.filter ?? [];
  if (filter.length > 0) return [...filter];
  if (params.catalogOnly) return (params.catalog ?? []).map((entry) => entry.name);
  return [];
}
