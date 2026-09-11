import { chromeDark, chromeLight } from 'react-inspector';
import type { Theme } from 'storybook/theming';

/**
 * react-inspector ships its own fixed light/dark palettes — picking between
 * them by `theme.base` (as the panel does) tracks Storybook's dark/light
 * toggle, but not a fully *re-themed* Storybook with its own brand colors.
 * Layer the actual theme's own background/text/border tokens over the
 * preset so the inspector genuinely matches a re-themed Storybook instead of
 * just its light/dark-ness. Syntax-highlighting accents (string/number/
 * boolean colors) stay on the preset — Storybook's theme object doesn't
 * define a syntax palette to draw from, so there's nothing truer to map to.
 */
export function inspectorTheme(theme: Theme) {
  const base = theme.base === 'dark' ? chromeDark : chromeLight;
  return {
    ...base,
    BASE_FONT_FAMILY: theme.typography.fonts.mono,
    BASE_BACKGROUND_COLOR: 'transparent',
    BASE_COLOR: theme.color.defaultText,
    TREENODE_FONT_FAMILY: theme.typography.fonts.mono,
    ARROW_COLOR: theme.textMutedColor,
  };
}
