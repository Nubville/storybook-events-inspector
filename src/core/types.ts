/**
 * Everything in `core/` is host-agnostic: no import from 'storybook/*' anywhere
 * in this directory. It doesn't know Storybook exists — a Storybook preview
 * decorator is one possible *consumer* of it, not something it depends on. The
 * same inspector could back a bookmarklet or a browser-extension content
 * script on a live page, unchanged.
 */

/** One event name as declared by a design system's manifest (e.g. custom-elements.json). */
export interface EventCatalogEntry {
  readonly name: string;
  /** Every tag that documents dispatching this event. Length > 1 means a shared name. */
  readonly tags: readonly string[];
}

/**
 * What the inspector hands a subscriber, in-process — still holds real
 * elements and an unsanitized detail. A host that renders in the same
 * document (a bookmarklet, an extension panel) can use this as-is. A host
 * that has to cross a serialization boundary (Storybook's manager/preview
 * channel) turns it into a `LogEntry` first — see `safeDetail`.
 */
export interface CapturedEvent {
  readonly type: string;
  readonly origin: Element;
  /** What an external listener (outside every shadow root involved) would see as `event.target`. */
  readonly externalTarget: Element;
  readonly composed: boolean;
  readonly detail: unknown;
}

/** A `CapturedEvent`, serialized and flattened for a UI that isn't in the same document. */
export interface LogEntry {
  readonly seq: number;
  readonly time: string;
  readonly name: string;
  /** The element that actually dispatched, described as a tag name. */
  readonly origin: string;
  /** What a plain `event.target` handler would have seen, described as a tag name. */
  readonly target: string;
  readonly retargeted: boolean;
  /** Never left its shadow root — invisible to anything outside it, including the host app. */
  readonly notComposed: boolean;
  /** Pre-serialized (may have started as elements/cycles the receiving UI can't touch). */
  readonly detail: unknown;
}

export interface DispatchOptions {
  readonly detail?: unknown;
  readonly bubbles: boolean;
  readonly composed: boolean;
}

export interface DispatchResult {
  readonly ok: boolean;
  readonly error?: string;
}
