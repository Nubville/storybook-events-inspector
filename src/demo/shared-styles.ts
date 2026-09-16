import { css } from 'lit';

/**
 * Shared across every demo-* fixture, so three components don't each
 * hand-roll the same button. There's nothing to import from Storybook's own
 * `Button` here on purpose: the story canvas is a genuinely separate
 * document from the manager UI — none of the manager's CSS-in-JS theming
 * crosses that boundary — so reaching for it would mean pulling manager-only
 * packages into the preview bundle for a handful of properties. This is
 * deliberately small instead: enough to not look like an unstyled `<button>`,
 * not a reimplementation of Storybook's own component.
 */
export const demoButtonStyles = css`
  button {
    font: inherit;
    font-size: 0.9rem;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: 1px solid #d1d5db;
    background: #f9fafb;
    color: #111827;
    cursor: pointer;
  }
  button:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
  }
  button:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }
`;
