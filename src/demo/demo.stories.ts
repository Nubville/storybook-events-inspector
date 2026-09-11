import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import './demo-button';
import './demo-toggle';

const meta: Meta = {
  title: 'Demo',
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj;

/**
 * Zero `wcCustomEvents` parameters here — capture is agnostic by default, no
 * catalog or registration required. Both fixtures fire the shared
 * `demo-change` name (watch it get flagged `shared`); shift-click the button
 * to also fire `demo-secret`, which isn't in `.storybook/preview.ts`'s
 * catalog at all and still shows up, flagged `undocumented`.
 */
export const Buttons: Story = {
  render: () => html`
    <div style="display: flex; gap: 1rem; align-items: center; font-family: sans-serif;">
      <demo-button></demo-button>
      <demo-toggle></demo-toggle>
    </div>
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
    wcCustomEvents: { filter: ['demo-change'] },
  },
  render: () => html`
    <div style="display: flex; gap: 1rem; align-items: center; font-family: sans-serif;">
      <demo-button></demo-button>
      <demo-toggle></demo-toggle>
    </div>
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
    wcCustomEvents: { catalogOnly: true },
  },
  render: () => html`
    <div style="display: flex; gap: 1rem; align-items: center; font-family: sans-serif;">
      <demo-button></demo-button>
      <demo-toggle></demo-toggle>
    </div>
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
  render: () => html`<demo-toggle></demo-toggle>`,
};
