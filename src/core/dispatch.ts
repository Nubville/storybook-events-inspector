import type { DispatchOptions, DispatchResult } from './types';

/**
 * The reverse direction: fire a synthetic event *at* a real element, the same
 * way host code commanding a component (or a test) would. Goes through the
 * same `dispatchEvent` call the inspector patches, so a dispatch triggered
 * from here shows up in the log too — nothing about it is treated specially.
 */
export function dispatchSyntheticEvent(target: EventTarget, name: string, options: DispatchOptions): DispatchResult {
  try {
    target.dispatchEvent(
      new CustomEvent(name, { detail: options.detail, bubbles: options.bubbles, composed: options.composed }),
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Finds the first actual custom element (a tag name containing a hyphen, per
 * the platform's own naming rule) inside `root`. Exists because the obvious
 * guess — the root's first child — is often a layout wrapper `<div>` instead
 * (Storybook's `parameters.layout: 'centered'` is one source of these; a
 * bookmarklet host dispatching against `document.body` would hit the same
 * problem with the page's own layout markup).
 */
export function findCustomElement(root: ParentNode): Element | null {
  for (const el of root.querySelectorAll('*')) {
    if (el.tagName.includes('-')) return el;
  }
  return null;
}
