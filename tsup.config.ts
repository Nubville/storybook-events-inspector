import { defineConfig, type Options } from 'tsup';

const NODE_TARGET = 'node20.19'; // Minimum Node version supported by Storybook 10

export default defineConfig(async () => {
  // reading the entry categories from package.json, which has the following structure:
  // {
  //  ...
  //   "bundler": {
  //     "managerEntries": ["./src/manager.ts"],
  //     "previewEntries": ["./src/preview.ts", "./src/index.ts"],
  //     "browserEntries": ["./src/core/browser-bundle.ts"],
  //     "mcpEntries": ["./src/mcp/server.ts"]
  //   }
  // }
  const packageJson = (await import('./package.json', { with: { type: 'json' } })).default;

  const {
    managerEntries = [],
    previewEntries = [],
    browserEntries = [],
    mcpEntries = [],
  } = packageJson.bundler as {
    managerEntries?: string[];
    previewEntries?: string[];
    browserEntries?: string[];
    mcpEntries?: string[];
  };

  const commonConfig: Options = {
    /*
     keep this line commented until https://github.com/egoist/tsup/issues/1270 is resolved
     clean: options.watch ? false : true,
    */
    clean: false,
    format: ['esm'],
    treeshake: true,
    splitting: true,
    /*
     The following packages are provided by Storybook and should always be externalized
     Meaning they shouldn't be bundled with the addon, and they shouldn't be regular dependencies either
    */
    external: ['react', 'react-dom', '@storybook/icons'],
  };

  const configs: Options[] = [];

  /*
   manager entries are entries meant to be loaded into the manager UI
   they'll have manager-specific packages externalized and they won't be usable in node
   they won't have types generated for them as they're usually loaded automatically by Storybook
  */
  if (managerEntries.length) {
    configs.push({
      ...commonConfig,
      entry: managerEntries,
      platform: 'browser',
      target: 'esnext', // we can use esnext for manager entries since Storybook will bundle the addon's manager entries again anyway
    });
  }

  /*
   preview entries are entries meant to be loaded into the preview iframe
   they'll have preview-specific packages externalized and they won't be usable in node
   they'll have types generated for them so they can be imported by users when setting up Portable Stories or using CSF factories
  */
  if (previewEntries.length) {
    configs.push({
      ...commonConfig,
      entry: previewEntries,
      platform: 'browser',
      target: 'esnext', // we can use esnext for preview entries since the builders will bundle the addon's preview entries again anyway
      dts: true,
    });
  }

  /*
   browser entries are self-contained bundles meant to be injected directly into a
   page as raw script content (no module loader present at injection time — the MCP
   server reads the file and hands its text to Playwright's addInitScript). Nothing
   externalized; IIFE; no code-splitting, since there's nowhere for a second chunk to
   be loaded from.
  */
  if (browserEntries.length) {
    configs.push({
      ...commonConfig,
      entry: browserEntries,
      platform: 'browser',
      target: 'es2020', // broad browser compat — this runs inside an arbitrary consumer's story, not our own tooling
      format: ['iife'],
      splitting: false,
      external: [],
    });
  }

  /*
   mcp entries are the standalone MCP server's Node entry point(s), published as a
   `bin`. Real runtime dependencies (playwright, the MCP SDK, zod) stay external —
   npm installs them normally rather than this addon carrying its own private copy.
  */
  if (mcpEntries.length) {
    configs.push({
      ...commonConfig,
      entry: mcpEntries,
      platform: 'node',
      target: NODE_TARGET,
      splitting: false,
      external: ['playwright', '@modelcontextprotocol/sdk', 'zod'],
      banner: { js: '#!/usr/bin/env node' },
    });
  }

  return configs;
});
