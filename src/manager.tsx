import React from 'react';
import { addons, types } from 'storybook/manager-api';

import { Panel } from './components/Panel';
import { PanelTitle } from './components/PanelTitle';
import { ADDON_ID, PANEL_ID } from './constants';

addons.register(ADDON_ID, () => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: PanelTitle,
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => <Panel active={active ?? false} />,
  });
});
