import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `core/` is the part worth testing: pure logic plus one DOM patch, and
    // no Storybook anywhere. jsdom gives it real custom elements and shadow
    // roots, which is all the capture engine needs.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // Each file gets its own environment, which matters here: the inspector
    // patches EventTarget.prototype at module load, and that patch is
    // deliberately permanent within a realm.
    isolate: true,
  },
});
