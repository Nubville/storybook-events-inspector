import type { Preview } from '@storybook/web-components-vite';

import { DEMO_EVENT_CATALOG } from '../src/demo/catalog';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    options: {
      // Introduction first, everything else in the order it's defined.
      storySort: {
        order: ['Introduction', '*'],
      },
    },
    // Project-wide default for this addon. A story can narrow it further with
    // `parameters.eventsInspector.filter` / `.extra`.
    eventsInspector: {
      catalog: DEMO_EVENT_CATALOG,
    },
  },
  initialGlobals: {
    background: { value: 'light' },
  },
};

export default preview;
