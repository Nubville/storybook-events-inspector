import type { EventCatalogEntry } from '../types';

/**
 * Stand-in for a design system's generated `custom-elements.json` → event
 * catalog. A real integration generates this file; here it's hand-written to
 * match the two sandbox fixtures below.
 */
export const DEMO_EVENT_CATALOG: readonly EventCatalogEntry[] = [
  { name: 'demo-change', tags: ['demo-button', 'demo-toggle'] },
  { name: 'demo-command', tags: ['demo-toggle'] },
  { name: 'demo-trapped', tags: ['demo-trap'] },
];
