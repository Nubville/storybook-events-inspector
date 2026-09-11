/**
 * The capture engine. Patches `EventTarget.prototype.dispatchEvent` once, in
 * whatever document this module runs in — every custom event any target
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
 *
 * The patch is installed at module load, not on first subscribe, and events
 * dispatched while nobody is listening are buffered — see `pending` below.
 */
import type { CapturedEvent } from './types';

type Listener = (event: CapturedEvent) => void;

const subscribers = new Set<Listener>();

/**
 * Events captured while there were zero subscribers, handed to the first
 * subscriber that shows up and then dropped.
 *
 * This exists because every host of this module subscribes *after* the first
 * render: a Storybook decorator subscribes in `useEffect`, and the MCP
 * session subscribes once `page.goto` resolves. A component that dispatches
 * from `connectedCallback` (or Lit's `firstUpdated`) has already fired by
 * then, so without a buffer the tool silently misses exactly the events a
 * component fires while wiring itself up — while claiming to see everything.
 *
 * Buffering only happens while `subscribers` is empty, which is why the
 * buffer can't leak one story's events into the next: a story swap doesn't
 * pass through a zero-subscriber state unless the decorator actually
 * unsubscribed, and whatever was pending is drained (not replayed twice) the
 * moment anyone subscribes.
 */
const pending: CapturedEvent[] = [];

/** Ceiling on `pending`, for the case where nothing ever subscribes. Oldest drop first. */
const MAX_PENDING = 1000;

/** True once `dispatchEvent` has been patched by this module instance, so a second call is a no-op. */
let patched = false;

/**
 * Walks from `origin` up through however many nested shadow roots to the
 * outermost host — exactly what `event.target` resolves to for a composed
 * event observed from outside every shadow root involved (i.e. from `window`
 * or `document`, where any external listener lives).
 *
 * A non-`Element` target (`document`, `window`, an `EventTarget` subclass)
 * isn't in a shadow tree and can't be retargeted, so it resolves to itself.
 */
function resolveExternalTarget(origin: EventTarget): EventTarget {
  let node: EventTarget = origin;
  while (node instanceof Element) {
    const root = node.getRootNode();
    if (!(root instanceof ShadowRoot)) return node;
    node = root.host;
  }
  return node;
}

/** The platform's own naming convention for custom events/elements — used to skip native-event noise. */
function looksLikeCustomEventName(type: string): boolean {
  return type.includes('-');
}

function notify(event: Event, origin: EventTarget): void {
  if (!looksLikeCustomEventName(event.type)) return;

  const captured: CapturedEvent = {
    type: event.type,
    origin,
    externalTarget: event.composed ? resolveExternalTarget(origin) : origin,
    composed: event.composed,
    inShadowTree: origin instanceof Element && origin.getRootNode() instanceof ShadowRoot,
    detail: (event as CustomEvent).detail,
  };

  if (subscribers.size === 0) {
    pending.push(captured);
    if (pending.length > MAX_PENDING) pending.splice(0, pending.length - MAX_PENDING);
    return;
  }

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
    //
    // Every EventTarget counts, not just Element: a design system routinely
    // dispatches app-level events (`theme-change`, `toast-show`) on
    // `document`, and an event bus is often a bare `EventTarget` subclass.
    // Those used to be dropped silently, which is the worst possible failure
    // for a tool whose whole claim is "if it isn't here, it didn't fire."
    notify(event, this);
    return result;
  };
}

// Patch at module load rather than on first subscribe, so the window between
// the page starting up and a host subscribing is captured (into `pending`)
// instead of lost.
patch();

/**
 * Subscribe to every captured custom event. Returns an unsubscribe function.
 *
 * If events were captured while nobody was subscribed, the first subscriber
 * receives them immediately, oldest first, before any live event — so a
 * component that dispatched from `connectedCallback` still shows up. Pass
 * `{ replay: false }` to drop that backlog instead; either way it's consumed,
 * so a later subscriber never receives stale events.
 *
 * Each subscriber gets its own callback, so multiple hosts (or multiple
 * Storybook story instances in docs mode) can coexist without conflicting.
 */
export function onCustomEvent(listener: Listener, options: { replay?: boolean } = {}): () => void {
  const { replay = true } = options;
  const isFirstSubscriber = subscribers.size === 0;
  subscribers.add(listener);

  if (isFirstSubscriber && pending.length > 0) {
    const backlog = pending.splice(0, pending.length);
    if (replay) for (const captured of backlog) listener(captured);
  }

  return () => {
    subscribers.delete(listener);
  };
}

/**
 * Test seam: drops every subscriber and any buffered backlog, returning this
 * module to the state it had at load. The `dispatchEvent` patch itself stays
 * installed — it's deliberately permanent, and re-patching would stack
 * wrappers.
 */
export function resetForTest(): void {
  subscribers.clear();
  pending.length = 0;
}
