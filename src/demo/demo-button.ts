import { LitElement, html, css } from 'lit';

/**
 * Sandbox-only fixture for this addon's own Storybook, NOT part of the addon.
 *
 * Deliberately dispatches from the internal <button> rather than from `this`,
 * so `event.target` (read from outside) gets retargeted to <demo-button> while
 * `composedPath()[0]` (the panel's "Fired by" column) still shows the true
 * origin — the exact trap the addon's RETARGETED flag exists to catch.
 *
 * Written with Lit's plain `static properties` API rather than decorators:
 * this file is served straight to the browser by Vite's dev server, and
 * standard (TC39) decorators + the `accessor` keyword that Lit 3 needs for
 * them aren't reliably parseable there yet. The addon's own source (built by
 * tsup/tsc, never shipped un-transformed) doesn't have that constraint.
 */
export class DemoButton extends LitElement {
  static override styles = css`
    button {
      font: inherit;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      border: 1px solid #8883;
      cursor: pointer;
    }
  `;

  static override properties = {
    _count: { state: true },
  };

  declare _count: number;

  constructor() {
    super();
    this._count = 0;
  }

  private _onClick = (event: MouseEvent): void => {
    this._count += 1;
    (event.currentTarget as HTMLElement).dispatchEvent(
      new CustomEvent('demo-change', {
        detail: { value: this._count, source: 'demo-button' },
        bubbles: true,
        composed: true,
      }),
    );

    // An event nobody documented. Only reachable via the addon's `extra` parameter.
    if (event.shiftKey) {
      this.dispatchEvent(new CustomEvent('demo-secret', { detail: { at: Date.now() }, bubbles: true, composed: true }));
    }
  };

  override render(): unknown {
    return html`<button @click=${this._onClick}>Clicked ${this._count}×</button>`;
  }
}

if (!customElements.get('demo-button')) {
  customElements.define('demo-button', DemoButton);
}
