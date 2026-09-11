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
  /**
   * What called `.dispatchEvent()`. Usually an `Element`, but `document`,
   * `window` and bare `EventTarget` subclasses (event buses) dispatch custom
   * events too, and all of them are captured.
   */
  readonly origin: EventTarget;
  /** What an external listener (outside every shadow root involved) would see as `event.target`. */
  readonly externalTarget: EventTarget;
  readonly composed: boolean;
  /**
   * Whether the origin sits inside a shadow root. This is what makes
   * `composed: false` a bug rather than a detail: an event dispatched from
   * the light DOM reaches the host app with or without `composed`, and
   * `document`/`window`/an event bus have no shadow boundary to be trapped
   * behind at all.
   */
  readonly inShadowTree: boolean;
  readonly detail: unknown;
}

/** A `CapturedEvent`, serialized and flattened for a UI that isn't in the same document. */
export interface LogEntry {
  readonly seq: number;
  readonly time: string;
  readonly name: string;
  /** What actually dispatched: a tag name, or `document`/`window`/an event bus class name. */
  readonly origin: string;
  /** What a plain `event.target` handler would have seen, described as a tag name. */
  readonly target: string;
  readonly retargeted: boolean;
  /**
   * Dispatched `composed: false` from *inside a shadow root*, so it never left
   * it — invisible to anything outside, including the host app. Not set for a
   * light-DOM or non-Element dispatch, where `composed` changes nothing.
   */
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
