import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import './demo-button';
import './demo-toggle';
import './demo-trap';

const meta: Meta = {
  title: 'Demo',
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj;

const hint = (text: string) =>
  html`<p style="color: #767676; font-size: 0.85rem; max-width: 28rem; margin: 0 0 1rem; font-family: sans-serif;">
    ${text}
  </p>`;

const row = (content: ReturnType<typeof html>) =>
  html`<div style="display: flex; gap: 1rem; align-items: center; font-family: sans-serif;">${content}</div>`;

/**
 * Zero `eventsInspector` parameters here — capture is agnostic by default, no
 * catalog or registration required. Both fixtures fire the shared
 * `demo-change` name (watch it get flagged `shared`); shift-click the button
 * to also fire `demo-secret`, which isn't in `.storybook/preview.ts`'s
 * catalog at all and still shows up, flagged `undocumented`.
 */
export const Buttons: Story = {
  render: () => html`
    ${hint(
      'Open the "Events inspector" panel below. Click either control — both fire demo-change, flagged shared. ' +
        'Shift-click the button for demo-secret, undocumented because it is nowhere in the catalog.',
    )}
    ${row(html`<demo-button></demo-button><demo-toggle></demo-toggle>`)}
  `,
};

/**
 * Dispatched from the internal `<button>`, not `this` — so `event.target`
 * outside reads the host `<demo-trap>`, but this specific event never gets
 * that far: `composed: false` keeps it inside the shadow root entirely. It
 * still shows up in the log, flagged `not composed`, because the addon
 * intercepts the dispatch call itself rather than listening from outside —
 * the one flag a `window`-listener-based tool structurally cannot show.
 */
export const NotComposed: Story = {
  render: () => html`
    ${hint(
      'Click the button. The panel still logs it — flagged "not composed" — even though a real listener ' +
        'anywhere outside this component, including your own host app, would never see it fire at all.',
    )}
    ${row(html`<demo-trap></demo-trap>`)}
  `,
};

/**
 * `filter` narrows the (already-complete) capture stream — here, to just the
 * catalog's own name, so `demo-secret` from a shift-click won't show up even
 * though it's still being dispatched. Useful when a story is noisy and you
 * only care about one interaction.
 */
export const Narrowed: Story = {
  parameters: {
    eventsInspector: { filter: ['demo-change'] },
  },
  render: () => html`
    ${hint(
      "parameters.eventsInspector.filter = ['demo-change']. Shift-click the button for demo-secret — it's " +
        'still dispatched, just filtered out of what this story shows.',
    )}
    ${row(html`<demo-button></demo-button><demo-toggle></demo-toggle>`)}
  `,
};

/**
 * `catalogOnly` is `filter` derived automatically from the catalog, for the
 * "my Custom Elements Manifest already lists everything I care about" case —
 * both catalog names (`demo-change`, `demo-command`) come through with no
 * `filter` array to maintain by hand, while `demo-secret` (not in the
 * catalog) is drowned out exactly like the explicit-filter example above.
 */
export const ScopedToCatalog: Story = {
  parameters: {
    eventsInspector: { catalogOnly: true },
  },
  render: () => html`
    ${hint(
      'parameters.eventsInspector.catalogOnly = true — narrows to the whole catalog automatically, no filter ' +
        'array to hand-maintain. Same noise reduction as Narrowed, generated instead of typed out.',
    )}
    ${row(html`<demo-button></demo-button><demo-toggle></demo-toggle>`)}
  `,
};

/**
 * A single element alone in the canvas, so the panel's "Dispatch" form can
 * target it directly. Send a `demo-command` from the panel and watch the
 * toggle print what it received — the addon's reverse direction: broadcasting
 * an event *for* a component to respond to, not just capturing what it fires.
 * The dispatch itself also shows up in the log below, same as anything else.
 */
export const ToggleOnly: Story = {
  render: () => html`
    ${hint(
      'Open "Dispatch event" in the panel, send demo-command with a detail like {"say":"hi"}, and watch the ' +
        'toggle print what it received below its own button — a real event reaching a real listener, from the panel.',
    )}
    ${row(html`<demo-toggle></demo-toggle>`)}
  `,
};
