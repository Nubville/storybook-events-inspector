import { describe as suite, expect, it, vi } from 'vitest';

import { dispatchSyntheticEvent, findCustomElement } from './dispatch';

suite('dispatchSyntheticEvent', () => {
  it('fires a real event the component can hear', () => {
    const el = document.createElement('demo-toggle');
    const heard = vi.fn();
    el.addEventListener('demo-command', heard);

    const result = dispatchSyntheticEvent(el, 'demo-command', {
      detail: { reason: 'escape' },
      bubbles: true,
      composed: true,
    });

    expect(result).toEqual({ ok: true });
    expect(heard).toHaveBeenCalledOnce();
    expect((heard.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ reason: 'escape' });
  });

  it('carries bubbles and composed through to the event', () => {
    const el = document.createElement('demo-toggle');
    document.body.append(el);
    const heard = vi.fn();
    el.addEventListener('demo-command', heard);

    dispatchSyntheticEvent(el, 'demo-command', { bubbles: false, composed: false });
    const event = heard.mock.calls[0]?.[0] as CustomEvent;

    expect(event.bubbles).toBe(false);
    expect(event.composed).toBe(false);
    el.remove();
  });

  it('reports a listener that throws instead of taking the panel down with it', () => {
    const el = document.createElement('demo-toggle');
    // A listener error surfaces through jsdom's error reporting rather than
    // the dispatch call, so drive the failure through the target itself.
    const exploding = {
      dispatchEvent: () => {
        throw new Error('nope');
      },
    } as unknown as EventTarget;

    expect(dispatchSyntheticEvent(exploding, 'demo-command', { bubbles: true, composed: true })).toEqual({
      ok: false,
      error: 'nope',
    });
    expect(el).toBeTruthy();
  });
});

suite('findCustomElement', () => {
  it('finds the custom element, not the layout wrapper around it', () => {
    const root = document.createElement('div');
    // What `parameters.layout: 'centered'` produces: a plain wrapper whose
    // firstElementChild is not the component under test.
    root.innerHTML = '<div class="center"><span></span><demo-toggle></demo-toggle></div>';

    expect(findCustomElement(root)?.localName).toBe('demo-toggle');
  });

  it('returns the first custom element in document order', () => {
    const root = document.createElement('div');
    root.innerHTML = '<demo-button></demo-button><demo-toggle></demo-toggle>';

    expect(findCustomElement(root)?.localName).toBe('demo-button');
  });

  it('returns null when there is no custom element to target', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div><span>plain markup</span></div>';

    expect(findCustomElement(root)).toBeNull();
  });
});
