import { describe as suite, expect, it } from 'vitest';

import { describe } from './describe';

suite('describe', () => {
  it('names an element by its lowercase tag', () => {
    expect(describe(document.createElement('DEMO-BUTTON'))).toBe('demo-button');
  });

  it('names document and window', () => {
    expect(describe(document)).toBe('document');
    expect(describe(window)).toBe('window');
  });

  it('names an event bus by its class, not [object Object]', () => {
    class EventBus extends EventTarget {}
    expect(describe(new EventBus())).toBe('EventBus');
  });

  it('falls back for a missing target', () => {
    expect(describe(null)).toBe('—');
    expect(describe(undefined)).toBe('—');
  });
});
