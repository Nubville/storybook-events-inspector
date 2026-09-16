import { LitElement, html, css } from 'lit';

import { demoButtonStyles } from './shared-styles';

/**
 * Sandbox-only fixture for this addon's own Storybook, NOT part of the addon.
 *
 * Fires the SAME `demo-change` name as `demo-button` (with a different detail
 * shape) — the addon's SHARED flag exists for exactly this: a listener bound on
 * an ancestor can't tell the two apart without also reading "Fired by".
 *
 * Also listens for `demo-command` on itself, for the addon's reverse direction:
 * the panel can dispatch a synthetic event *at* this element to check that it
 * responds the way its docs claim.
 *
 * Written with Lit's plain `static properties` API rather than decorators —
 * see demo-button.ts for why.
 */
export class DemoToggle extends LitElement {
  static override styles = [
    css`
      :host {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font: inherit;
      }
    `,
    demoButtonStyles,
  ];

  static override properties = {
    checked: { type: Boolean, reflect: true },
    _lastCommand: { state: true },
  };

  declare checked: boolean;
  declare _lastCommand: string;

  constructor() {
    super();
    this.checked = false;
    this._lastCommand = '';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('demo-command', this._onCommand as EventListener);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('demo-command', this._onCommand as EventListener);
    super.disconnectedCallback();
  }

  private _onCommand = (event: CustomEvent): void => {
    this._lastCommand = JSON.stringify(event.detail ?? null);
  };

  private _onClick = (): void => {
    this.checked = !this.checked;
    this.dispatchEvent(
      new CustomEvent('demo-change', {
        detail: { checked: this.checked, source: 'demo-toggle' },
        bubbles: true,
        composed: true,
      }),
    );
  };

  override render(): unknown {
    return html`
      <button @click=${this._onClick}>${this.checked ? '☑' : '☐'} Toggle</button>
      ${this._lastCommand ? html`<small>received: ${this._lastCommand}</small>` : null}
    `;
  }
}

if (!customElements.get('demo-toggle')) {
  customElements.define('demo-toggle', DemoToggle);
}
