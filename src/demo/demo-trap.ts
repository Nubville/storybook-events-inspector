import { LitElement, html } from 'lit';

import { demoButtonStyles } from './shared-styles';

/**
 * Sandbox-only fixture for this addon's own Storybook, NOT part of the addon.
 *
 * Dispatches from the internal <button> — same as demo-button.ts — but with
 * `composed: false`. Since the origin is inside this element's shadow root
 * and the event isn't composed, it never leaves that root: no listener
 * outside this component, including the real host app, can ever see it. A
 * `window`-listener-based tool couldn't show this at all, capture-phase or
 * not — it's exactly what patching `dispatchEvent` at the call site exists
 * to catch. Written with Lit's plain `static properties` API — see
 * demo-button.ts for why.
 */
export class DemoTrap extends LitElement {
  static override styles = demoButtonStyles;

  private _onClick = (event: MouseEvent): void => {
    (event.currentTarget as HTMLElement).dispatchEvent(
      new CustomEvent('demo-trapped', {
        detail: { note: 'this never reaches window — no composed: true' },
        bubbles: true,
        composed: false,
      }),
    );
  };

  override render(): unknown {
    return html`<button @click=${this._onClick}>Click — fires a trapped event</button>`;
  }
}

if (!customElements.get('demo-trap')) {
  customElements.define('demo-trap', DemoTrap);
}
