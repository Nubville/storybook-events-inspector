# Contributing

Thanks for taking a look. This is a young, single-maintainer project — issues
and PRs are welcome, but response times may vary.

## Setup

```sh
git clone https://github.com/Nubville/wc-custom-events.git
cd wc-custom-events
pnpm install
```

## Working on it

```sh
pnpm build          # compile the addon (manager/preview) + browser bundle + MCP server → dist/
pnpm storybook       # run this repo's own Storybook (src/demo/) at localhost:6006, to see changes live
pnpm mcp             # run the MCP server standalone against that Storybook
pnpm lint            # eslint (prettier included)
pnpm lint:fix        # auto-fix what can be
npx tsc --noEmit     # type-check without emitting
```

There's no automated test suite yet — changes are verified by running the
addon against `src/demo/` in a real Storybook and, for MCP changes, against a
real MCP client (see below). If you're touching `src/core/`, `src/preview.ts`,
`src/components/`, or `src/mcp/`, please actually run it rather than trust a
clean type-check alone — several real bugs in this project were only caught
that way (see the "How it works" section of the README for the shape of
`core/` vs. the Storybook/MCP adapters over it, if you're not sure where a
change belongs).

To exercise the MCP server directly without a real MCP client, use the SDK's
own `Client` + `StdioClientTransport` to script calls against
`dist/server.js` — see the MCP section of the README for the shape.

## Reporting a bug

Please include:

- What you expected vs. what happened.
- The addon version, Storybook version, and framework (`@storybook/web-components-vite`, etc.)
- A minimal story that reproduces it, if you can — especially for anything
  involving shadow DOM/composed events, since the exact structure matters a
  lot here.

## Proposing a change

Small fixes: open a PR directly. Anything that changes the shape of
`parameters.wcCustomEvents`, the MCP tool contracts, or what `core/` exposes:
please open an issue first to talk through it — those are the parts other
people's config/scripts end up depending on.

## Scope

This addon's job is custom DOM events (`dispatchEvent`) on web components —
see the README's "What this deliberately doesn't cover" note. PRs adding
framework-specific reactivity tracking (React callbacks, Vue `$emit`, Lit
Signals, etc.) are probably out of scope for this package; happy to discuss
in an issue first if you think otherwise.
