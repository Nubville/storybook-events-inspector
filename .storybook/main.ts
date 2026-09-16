import { defineMain } from '@storybook/web-components-vite/node';

const config = defineMain({
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-docs', import.meta.resolve('./local-preset.ts')],
  framework: '@storybook/web-components-vite',
});

export default config;
