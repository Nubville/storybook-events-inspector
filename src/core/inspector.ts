/**
 * The capture engine. Patches `EventTarget.prototype.dispatchEvent` once, in
 * whatever document this module runs in — every custom event any element
 * dispatches, anywhere in the tree, goes through exactly one JS method call,
 * the same way every Redux action goes through exactly one `store.dispatch`
 * call. That single choke point is what makes this agnostic: no registration,
 * no catalog required, works for any custom element regardless of what
 * authored it (Lit, Stencil, vanilla).
 *
 * Two things fall out of intercepting at the call site instead of listening
 * on `window`:
 *
 *  - Real user interaction (a mouse click, a keypress) is dispatched by the
 *    browser engine itself, never through a JS call to `.dispatchEvent()` —
 *    so native noise is excluded for free, no catalog needed to keep it out.
 *  - An event authored with `composed: false` never reaches `window` at all
 *    (its propagation path never leaves its shadow tree — capture phase or
 *    not), which made it invisible to the previous window-listener design.
 *    Intercepting the call itself sees it regardless. That's arguably the
 *    single most valuable trap to flag: forgetting `composed: true` makes an
 *    event invisible to the *entire host app*, not just this tool.
 *
 * "Retargeted" is computed structurally rather than by comparing against an
 * actual external listener's `event.target` (which is only reliable from
 * inside a real listener during dispatch — see `resolveExternalTarget`).
 */
import type { CapturedEvent } from './types';

type Listener = (event: CapturedEvent) => void;

const subscribers = new Set<Listener>();

/** True once `dispatchEvent` has been patched in this document, so a second call is a no-op. */
let patched = false;

/**
 * Walks from `origin` up through however many nested shadow roots to the
 * outermost host — exactly what `event.target` resolves to for a composed
 * event observed from outside every shadow root involved (i.e. from `window`
 * or `document`, where any external listener lives).
 */
function resolveExternalTarget(origin: Element): Element {
  let node: Element = origin;
  for (;;) {
    const root = node.getRootNode();
    if (!(root instanceof ShadowRoot)) return node;
    node = root.host;
  }
}

/** The platform's own naming convention for custom events/elements — used to skip native-event noise. */
function looksLikeCustomEventName(type: string): boolean {
  return type.includes('-');
}

function notify(event: Event, origin: Element): void {
  if (!looksLikeCustomEventName(event.type)) return;

  const captured: CapturedEvent = {
    type: event.type,
    origin,
    externalTarget: event.composed ? resolveExternalTarget(origin) : origin,
    composed: event.composed,
    detail: (event as CustomEvent).detail,
  };
  for (const subscriber of subscribers) subscriber(captured);
}

function patch(): void {
  if (patched) return;
  patched = true;

  const original = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (this: EventTarget, event: Event): boolean {
    const result = original.call(this, event);
    // Notify after dispatch completes — this is passive observation, and
    // never affects the return value the caller sees.
    if (this instanceof Element) notify(event, this);
    return result;
  };
}

/**
 * Subscribe to every captured custom event from here on. Returns an
 * unsubscribe function. The underlying patch is a page-wide singleton
 * (applied at most once, on the first subscriber) — each subscriber gets its
 * own callback, so multiple hosts (or multiple Storybook story instances in
 * docs mode) can coexist without conflicting.
 */
export function onCustomEvent(listener: Listener): () => void {
  patch();
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}
