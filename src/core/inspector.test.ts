import { afterEach, describe as suite, expect, it, vi } from 'vitest';

import { onCustomEvent, resetForTest } from './inspector';
import type { CapturedEvent } from './types';

afterEach(() => {
  resetForTest();
  document.body.innerHTML = '';
});

/** Collects everything a subscriber sees, so assertions read as "what did the panel get". */
function collect(options?: { replay?: boolean }): { seen: CapturedEvent[]; stop: () => void } {
  const seen: CapturedEvent[] = [];
  const stop = onCustomEvent((event) => seen.push(event), options);
  return { seen, stop };
}

function element(tag = 'demo-button'): HTMLElement {
  const el = document.createElement(tag);
  document.body.append(el);
  return el;
}

suite('capture', () => {
  it('captures a custom event dispatched on an element', () => {
    const { seen } = collect();
    element().dispatchEvent(new CustomEvent('demo-change', { detail: { value: 1 } }));

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ type: 'demo-change', detail: { value: 1 } });
  });

  it('requires no registration — an event name it has never been told about still arrives', () => {
    const { seen } = collect();
    element().dispatchEvent(new CustomEvent('never-declared-anywhere'));

    expect(seen.map((e) => e.type)).toEqual(['never-declared-anywhere']);
  });

  it('ignores native-looking names, which have no hyphen', () => {
    const { seen } = collect();
    const el = element();
    el.dispatchEvent(new Event('click'));
    el.dispatchEvent(new Event('focus'));
    el.dispatchEvent(new CustomEvent('demo-change'));

    expect(seen.map((e) => e.type)).toEqual(['demo-change']);
  });

  it('does not change what dispatchEvent returns', () => {
    collect();
    const el = element();
    el.addEventListener('demo-change', (event) => event.preventDefault());

    const cancelled = new CustomEvent('demo-change', { cancelable: true });
    expect(el.dispatchEvent(cancelled)).toBe(false);
    expect(el.dispatchEvent(new CustomEvent('demo-change'))).toBe(true);
  });

  it('stops delivering after unsubscribe', () => {
    const { seen, stop } = collect();
    const el = element();
    el.dispatchEvent(new CustomEvent('demo-change'));
    stop();
    el.dispatchEvent(new CustomEvent('demo-change'));

    expect(seen).toHaveLength(1);
  });

  it('delivers to every subscriber independently', () => {
    const first = collect();
    const second = collect();
    element().dispatchEvent(new CustomEvent('demo-change'));

    expect(first.seen).toHaveLength(1);
    expect(second.seen).toHaveLength(1);
  });
});

suite('non-Element dispatch targets', () => {
  it('captures events dispatched on document', () => {
    const { seen } = collect();
    document.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: 'dark' } }));

    expect(seen).toHaveLength(1);
    expect(seen[0]?.origin).toBe(document);
  });

  // In a real browser `window` inherits dispatchEvent from EventTarget.prototype
  // (verified: `window.dispatchEvent === EventTarget.prototype.dispatchEvent`),
  // so the patch covers it. jsdom instead gives its Window an *own*
  // dispatchEvent, which no prototype patch can reach — an artifact of the test
  // environment, not a gap in the engine. Skip rather than assert a falsehood in
  // either direction; the browser behaviour is covered end-to-end against a real
  // Storybook.
  it.skipIf(window.dispatchEvent !== EventTarget.prototype.dispatchEvent)(
    'captures events dispatched on window',
    () => {
      const { seen } = collect();
      window.dispatchEvent(new CustomEvent('app-ready'));

      expect(seen.map((e) => e.type)).toEqual(['app-ready']);
    },
  );

  it('captures events dispatched on a bare EventTarget subclass (an event bus)', () => {
    class EventBus extends EventTarget {}
    const bus = new EventBus();
    const { seen } = collect();
    bus.dispatchEvent(new CustomEvent('store-change', { detail: { count: 2 } }));

    expect(seen).toHaveLength(1);
    expect(seen[0]?.origin).toBe(bus);
  });

  it('never marks a non-Element target as retargeted', () => {
    const { seen } = collect();
    document.dispatchEvent(new CustomEvent('theme-change', { composed: true }));

    expect(seen[0]?.origin).toBe(seen[0]?.externalTarget);
  });
});

suite('inShadowTree — what makes composed:false a bug rather than a detail', () => {
  it('is false for a light-DOM element, which reaches the host app either way', () => {
    const { seen } = collect();
    element().dispatchEvent(new CustomEvent('demo-change', { bubbles: true, composed: false }));

    expect(seen[0]?.inShadowTree).toBe(false);
  });

  it('is false for document, window and an event bus — none has a boundary to be trapped behind', () => {
    class EventBus extends EventTarget {}
    const { seen } = collect();
    document.dispatchEvent(new CustomEvent('theme-change'));
    new EventBus().dispatchEvent(new CustomEvent('store-change'));

    expect(seen.map((e) => e.inShadowTree)).toEqual([false, false]);
  });

  it('is true for an element inside a shadow root', () => {
    const host = element('demo-wrapper');
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('demo-button');
    shadow.append(inner);

    const { seen } = collect();
    inner.dispatchEvent(new CustomEvent('demo-change', { bubbles: true, composed: false }));

    expect(seen[0]?.inShadowTree).toBe(true);
  });
});

suite('retargeting', () => {
  it('resolves a composed event to the outermost shadow host', () => {
    const host = element('demo-wrapper');
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('demo-button');
    shadow.append(inner);

    const { seen } = collect();
    inner.dispatchEvent(new CustomEvent('demo-change', { bubbles: true, composed: true }));

    expect(seen[0]?.origin).toBe(inner);
    expect(seen[0]?.externalTarget).toBe(host);
  });

  it('climbs through nested shadow roots to the outermost host', () => {
    const outer = element('demo-outer');
    const outerShadow = outer.attachShadow({ mode: 'open' });
    const middle = document.createElement('demo-middle');
    outerShadow.append(middle);
    const innerShadow = middle.attachShadow({ mode: 'open' });
    const inner = document.createElement('demo-button');
    innerShadow.append(inner);

    const { seen } = collect();
    inner.dispatchEvent(new CustomEvent('demo-change', { bubbles: true, composed: true }));

    expect(seen[0]?.externalTarget).toBe(outer);
  });

  it('leaves a non-composed event at its origin — it never crosses the boundary to be retargeted', () => {
    const host = element('demo-wrapper');
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('demo-button');
    shadow.append(inner);

    const { seen } = collect();
    inner.dispatchEvent(new CustomEvent('demo-change', { bubbles: true, composed: false }));

    expect(seen[0]?.composed).toBe(false);
    expect(seen[0]?.externalTarget).toBe(inner);
  });

  it('sees a composed:false event at all — the reason for patching the call site', () => {
    const host = element('demo-wrapper');
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('demo-button');
    shadow.append(inner);

    const windowListener = vi.fn();
    window.addEventListener('demo-change', windowListener, true);
    const { seen } = collect();
    inner.dispatchEvent(new CustomEvent('demo-change', { bubbles: true, composed: false }));
    window.removeEventListener('demo-change', windowListener, true);

    // The design claim, asserted rather than described: a window listener —
    // even in the capture phase — cannot see this event, and we can.
    expect(windowListener).not.toHaveBeenCalled();
    expect(seen).toHaveLength(1);
  });
});

suite('buffering events fired before anyone subscribes', () => {
  it('replays events dispatched while there were no subscribers', () => {
    // The connectedCallback case: the component fires before the host has
    // had a chance to subscribe.
    element().dispatchEvent(new CustomEvent('ready-on-connect', { detail: { phase: 'connectedCallback' } }));

    const { seen } = collect();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ type: 'ready-on-connect', detail: { phase: 'connectedCallback' } });
  });

  it('replays the backlog oldest first, before any live event', () => {
    const el = element();
    el.dispatchEvent(new CustomEvent('first-event'));
    el.dispatchEvent(new CustomEvent('second-event'));

    const { seen } = collect();
    el.dispatchEvent(new CustomEvent('third-event'));

    expect(seen.map((e) => e.type)).toEqual(['first-event', 'second-event', 'third-event']);
  });

  it('consumes the backlog, so a second subscriber does not receive it again', () => {
    element().dispatchEvent(new CustomEvent('ready-on-connect'));

    const first = collect();
    const second = collect();

    expect(first.seen).toHaveLength(1);
    expect(second.seen).toHaveLength(0);
  });

  it('drops the backlog without replaying when asked, and still consumes it', () => {
    element().dispatchEvent(new CustomEvent('ready-on-connect'));

    const first = collect({ replay: false });
    const second = collect();

    expect(first.seen).toHaveLength(0);
    expect(second.seen).toHaveLength(0);
  });

  it('does not carry events across a resubscribe gap while a subscriber is live', () => {
    // A story swap where the decorator never unsubscribed: nothing should be
    // buffered at all, because a subscriber existed the whole time.
    const { seen, stop } = collect();
    element().dispatchEvent(new CustomEvent('demo-change'));
    expect(seen).toHaveLength(1);

    stop();
    const next = collect();
    expect(next.seen).toHaveLength(0);
  });

  it('caps the backlog instead of growing without bound when nothing ever subscribes', () => {
    const el = element();
    for (let i = 0; i < 1200; i++) el.dispatchEvent(new CustomEvent(`event-${i}`));

    const { seen } = collect();
    expect(seen).toHaveLength(1000);
    // Oldest dropped first, so the most recent events are the ones kept.
    expect(seen.at(-1)?.type).toBe('event-1199');
    expect(seen[0]?.type).toBe('event-200');
  });
});
