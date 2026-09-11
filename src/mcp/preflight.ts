/**
 * The MCP server's runtime dependencies are declared as *optional* peer
 * dependencies, so installing this package for its Storybook panel alone
 * doesn't drag in Playwright and a browser download (~32 MB of node_modules
 * plus a ~94 MB browser) that the panel never touches.
 *
 * The cost of that choice is this file: without it, running the server
 * without those installed dies on a raw `ERR_MODULE_NOT_FOUND` stack trace
 * naming an internal path, which tells the reader nothing about what to do.
 * So resolve them first and say plainly what's missing and how to fix it.
 *
 * This must run *before* anything imports them, which is why `server.ts`
 * reaches for them with `await import(...)` rather than a static import —
 * static imports are hoisted and would blow up before this ever ran.
 */
import { createRequire } from 'node:module';

/**
 * Every package the server needs at runtime but does not install itself.
 *
 * `specifier` is what actually gets imported, and is what we resolve —
 * deliberately not the bare package name. `@modelcontextprotocol/sdk` publishes
 * an `exports` map with no root entry, so resolving the bare name throws even
 * when the package is installed and working; checking the real subpath is both
 * more accurate and a truer test of what the import will do. `install` is the
 * name to put in front of the user, which is the package, not the subpath.
 */
const REQUIRED = [
  { install: '@modelcontextprotocol/sdk', specifier: '@modelcontextprotocol/sdk/server/mcp.js' },
  { install: 'playwright', specifier: 'playwright' },
  { install: 'zod', specifier: 'zod' },
] as const;

export function assertDependencies(): void {
  const require = createRequire(import.meta.url);
  const missing = REQUIRED.filter(({ specifier }) => {
    try {
      require.resolve(specifier);
      return false;
    } catch {
      return true;
    }
  }).map(({ install }) => install);

  if (missing.length === 0) return;

  process.stderr.write(
    [
      '',
      `storybook-events-inspector-mcp is missing ${missing.length === 1 ? 'a dependency' : 'dependencies'}:`,
      ...missing.map((name) => `  - ${name}`),
      '',
      'These are optional peer dependencies, so installing this addon for its',
      'Storybook panel alone stays lightweight. The MCP server needs them:',
      '',
      `  npm install --save-dev ${REQUIRED.map((dep) => dep.install).join(' ')}`,
      '  npx playwright install chromium',
      '',
    ].join('\n'),
  );
  process.exit(1);
}
