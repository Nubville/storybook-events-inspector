export type { EventCatalogEntry, LogEntry, DispatchResult } from './core/types';
import type { EventCatalogEntry } from './core/types';

/**
 * Set via `parameters.eventsInspector` in `.storybook/preview.ts` (project-wide) and/or
 * narrowed per component/story — parameters cascade, so a story's `filter` naturally
 * overrides the project default.
 */
export interface EventsInspectorParameters {
  /** Annotates captured events — does NOT gate what's captured. Omit and everything is `undocumented`. */
  readonly catalog?: readonly EventCatalogEntry[];
  /** Narrows the (already-complete) capture stream to just these names. Empty/omitted keeps everything. */
  readonly filter?: readonly string[];
  /** Adds names back on top of a non-empty `filter`. No effect when `filter` is empty. */
  readonly extra?: readonly string[];
  /**
   * Narrow automatically to your catalog's own names, without repeating them
   * in `filter` — for the common case of a catalog generated wholesale from a
   * Custom Elements Manifest, where "my events" and "the whole catalog" are
   * the same list. Ignored if `filter` is set explicitly (`filter` wins).
   */
  readonly catalogOnly?: boolean;
  /** Rows kept in the panel before older ones drop off. Default 100. */
  readonly maxEvents?: number;
  /** Hide the detail column. */
  readonly compact?: boolean;
  /** Panel heading. Default 'Events inspector'. */
  readonly label?: string;
}

/** manager -> preview: ask the canvas to dispatch a synthetic event, for a specific story. */
export interface DispatchRequest {
  readonly storyId: string;
  readonly name: string;
  /** JSON detail, already parsed. */
  readonly detail?: unknown;
  readonly bubbles: boolean;
  readonly composed: boolean;
}
