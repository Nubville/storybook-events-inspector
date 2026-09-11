# storybook-events-inspector

A Storybook panel for design systems whose public API _is_ their events: a
component fires one event, the host owns the workflow. That means "is this
thing working?" is almost always "did it fire, and with what?" — a question
the browser gives you no good way to ask, and that a story-embedded debug
element only answers for stories someone remembered to add it to.

This addon answers it globally, with zero markup and **zero registration**,
for every story:

- **Capture** — sees every custom event any target dispatches, automatically:
  elements, `document`, `window`, and bare `EventTarget` subclasses (the usual
  shape of an event bus). Including events dispatched while the component is
  still rendering, from `connectedCallback` or Lit's `firstUpdated`. No catalog
  required to see something; a catalog is optional annotation on top of a
  stream that's already complete (see [How it works](#how-it-works)).
- **Flags four traps that cost hours when hit blind**: an event dispatched
  from inside a shadow root without `composed: true`, so it never left that
  root and is invisible to the _entire host app_, not just this panel
  (`not composed`) — a name
  declared by more than one tag (`shared`) — `event.target` not matching the
  true dispatch origin because a composed event crossed a shadow boundary
  (`retargeted`) — and an event that fired but isn't in your catalog at all
  (`undocumented`).
- **Dispatch** — the reverse direction. Fire a synthetic event _at_ the
  rendered component from the panel, to check it responds the way its docs
  claim, without writing a throwaway `play` function. The dispatch itself
  shows up in the log too, like anything else.

## Install

```sh
npm install --save-dev storybook-events-inspector
```

```ts
// .storybook/main.ts
const config = {
  addons: ['storybook-events-inspector'],
};
```

That's it — open the **Events inspector** panel next to Controls/Actions/Interactions
and interact with any story. No catalog, no config, nothing to register.

## Usage

Everything below is optional narrowing/annotation on top of capture that
already works with zero configuration.

### Reducing noise: `filter` / `extra`

```ts
export const Default: Story = {
  parameters: {
    eventsInspector: {
      filter: ['item-change'], // narrow the stream to just this name
      extra: ['secret-event'], // add this back even though filter is set
    },
  },
};
```

`filter` narrows; an empty (default) `filter` keeps everything. `extra` only
does anything when `filter` is non-empty — it's how you say "just these,
plus this one more."

### Adding meaning: `catalog`

```ts
// .storybook/preview.ts
import type { Preview } from '@storybook/web-components-vite';

const preview: Preview = {
  parameters: {
    eventsInspector: {
      // Typically generated from custom-elements.json — one entry per event
      // name, with every tag that documents dispatching it.
      catalog: [
        { name: 'item-change', tags: ['search-input', 'sort-by'] },
        { name: 'list-load-more', tags: ['pagination'] },
      ],
    },
  },
};

export default preview;
```

Without a catalog, every captured event is (correctly) `undocumented` — you
still see everything, you just don't get the `shared`/`undocumented`
distinction. Add one when you want the panel to know what's actually part of
your documented API surface.

Parameters cascade normally (project → component → story), so a story can
override the project default.

### Parameters (`parameters.eventsInspector`)

| Key           | Type                 | Default              | Effect                                                                                                 |
| ------------- | -------------------- | -------------------- | ------------------------------------------------------------------------------------------------------ |
| `catalog`     | `{ name, tags[] }[]` | `[]`                 | Annotates captured events with `shared`/`undocumented`. Doesn't gate capture.                          |
| `filter`      | `string[]`           | `[]` (everything)    | Narrows the capture stream to just these names.                                                        |
| `catalogOnly` | `boolean`            | `false`              | Derives `filter` from the catalog's own names, so you don't repeat them. Ignored when `filter` is set. |
| `extra`       | `string[]`           | `[]`                 | Adds names back on top of a non-empty `filter`. No-op when `filter` is empty.                          |
| `maxEvents`   | `number`             | `100`                | Rows kept in the panel before older ones drop.                                                         |
| `compact`     | `boolean`            | `false`              | Hide the detail column.                                                                                |
| `label`       | `string`             | `'Events inspector'` | Panel heading.                                                                                         |

## How it works

**Agnostic by construction, not by convention.** Every custom event any
element dispatches — in Lit, Stencil, or vanilla JS — goes through exactly one
platform method: `EventTarget.prototype.dispatchEvent`. That's the same
reason Redux DevTools doesn't need you to register action types: it wraps
`store.dispatch`, the one place every action already funnels through. DOM
custom events have the same kind of chokepoint; we patch it once, and get
complete coverage with no catalog and no per-name listener registration.

Two things fall out of intercepting the call site instead of listening on
`window` for known names:

- **Native events are excluded for free.** A real click is dispatched by the
  browser engine itself, never through a JS call to `.dispatchEvent()` — so
  patching it naturally filters out native noise. (We also skip any dispatched
  type that doesn't contain a hyphen, the platform's own custom-event naming
  convention, to filter out synthetic native-named dispatches from things like
  testing libraries.)
- **`composed: false` events become visible.** A `window`-level listener,
  capture phase or not, never sees an event whose propagation path never
  leaves its shadow root. Intercepting the dispatch call itself sees it
  regardless — which is how the `not composed` flag exists at all, and it's
  arguably the single highest-value one: that bug makes an event invisible to
  the _entire host app_, not just this tool. The flag is only raised when the
  origin is genuinely inside a shadow tree: from the light DOM, or from
  `document`/`window`/an event bus, `composed` changes nothing and flagging it
  would be a false alarm.

Two further consequences of owning the choke point:

- **Every `EventTarget` counts, not just elements.** A design system routinely
  dispatches app-level events (`theme-change`, `toast-show`) on `document`, and
  an event bus is often a bare `EventTarget` subclass. Those are captured too,
  and read in the log as `document` / `window` / the bus's class name.
- **Capture starts at module load, not at first subscribe.** Events dispatched
  before a panel (or the MCP session) is listening are buffered and handed to
  the first subscriber, so a component that fires from `connectedCallback`
  still shows up instead of being lost to the startup gap.

### Core vs. adapter

```
src/core/               host-agnostic — no import from 'storybook/*' anywhere here
  inspector.ts            the dispatchEvent patch + subscribe/notify
  dispatch.ts              the reverse direction + "find the real custom element"
  catalog.ts                shared/undocumented + filter matching (pure functions)
  describe.ts, safeDetail.ts, types.ts
  browser-bundle.ts        self-contained build of the above for injection into
                             a page with no module loader — see the MCP server below

src/preview.ts, src/manager.tsx,
src/components/         Storybook adapter: preview.ts subscribes to core and
                          forwards over the Storybook channel; the panel (React,
                          same as the built-in Actions addon) renders what arrives.

src/mcp/                MCP server adapter: session.ts drives a headless browser
                          straight to a story's iframe.html (bypassing the Storybook
                          manager/channel entirely) and injects core/browser-bundle.js
                          directly — see "MCP server" below.
```

`core/` doesn't know Storybook exists — the MCP server adapter is proof, not
just a promise: it reuses `inspector.ts`, `dispatch.ts`, and `catalog.ts`
completely unchanged, against a page that never loads the Storybook manager at
all. The same bundle could equally back a bookmarklet or a browser-extension
content script on a _live, deployed_ page — catching real user flows, not
just what a Storybook interaction test exercises.

**What this deliberately doesn't cover**: framework-level reactivity (Lit
Signals, MobX observables, Vue refs, …) isn't a DOM API — there's no single
chokepoint to patch generically the way `dispatchEvent` is one for custom
events, and each library's internals are shaped differently. Watching one
would mean a separate, purpose-built `core/`-style adapter for that specific
library, added only when a real component actually needs it — not a
speculative addition now.

## MCP server — for AI agents

A standalone MCP server, separate from Storybook's own `@storybook/addon-mcp`.
That's deliberate, not a missed integration: as of writing, Storybook's MCP
server has no extension point for a third-party addon to register its own
tools, and its "docs" toolset (component manifest lookup) doesn't cover
web-components projects yet. So this exposes this addon's own domain
directly — the same capture/dispatch loop the Storybook panel gives a human,
callable by an agent.

### Setup

Requires **Node 20.19+**.

The server's runtime dependencies are **optional peer dependencies**, so
installing this package for its Storybook panel alone doesn't pull down
Playwright and a browser binary the panel never uses. Install them when you
want the MCP server:

```sh
npm install --save-dev @modelcontextprotocol/sdk playwright zod
npx playwright install chromium
```

(Run the server without them and it prints exactly that, rather than failing
with a module-resolution stack trace.)

Then check it starts before wiring any client to it — it should print the
missing-dependency message or simply wait on stdio, not crash:

```sh
npx storybook-events-inspector-mcp --storybook-url http://localhost:6006
```

```jsonc
// .mcp.json (project-level MCP config, e.g. for Claude Code)
{
  "mcpServers": {
    "storybook-events-inspector": {
      "command": "npx",
      "args": [
        "storybook-events-inspector-mcp",
        "--storybook-url",
        "http://localhost:6006",
        "--catalog",
        "./custom-elements-catalog.json", // optional
      ],
    },
  },
}
```

`npx` here does **not** download anything: the package is already a local
devDependency, and `npx` resolves `node_modules/.bin` first. It's needed
because that directory isn't on `PATH`, so an MCP client spawning the bare
command name would fail with `ENOENT`.

Flags:

- `--storybook-url` (default `http://localhost:6006`) — set this if your
  Storybook runs anywhere else; the server won't discover it.
- `--catalog <path>` (optional) — a JSON file of the same `{ name, tags }[]`
  shape as the addon's own `parameters.eventsInspector.catalog`, used for the
  same `shared`/`undocumented` annotation. Relative paths resolve from the
  working directory the MCP client launches the server in, which is normally
  your project root; use an absolute path if your client differs. Omit it and
  everything is (correctly) `undocumented` — capture itself is unaffected
  either way. See [Generating the catalog](#generating-the-catalog) below.

Storybook has to already be running (`pnpm storybook` or equivalent) — the
server drives a real, separate headless browser against it, it doesn't start
Storybook itself.

### Generating the catalog

`shared` and `undocumented` only mean anything with a catalog, and the
`{ name, tags }[]` shape is a direct projection of a Custom Elements
Manifest — so it's generated, never hand-written:

```sh
npx storybook-events-inspector-setup catalog
```

It finds your manifest via `package.json`'s `customElements` field (the CEM
spec's own pointer), falling back to `./custom-elements.json`,
`./dist/custom-elements.json` and `./custom-elements-manifest.json`. Pass
`--manifest <path>` to be explicit, `--out <path>` to change the destination
(default `events-catalog.json`).

The manifest is indexed by element ("what does this tag fire?"); the catalog
inverts it to be indexed by event ("which tags fire this name?"). That
inversion is what makes `shared` computable — a name reachable from more than
one tag is exactly one a listener on a common ancestor can't attribute:

```json
[
  { "name": "item-change", "tags": ["my-button", "my-toggle"] },
  { "name": "my-click", "tags": ["my-button"] }
]
```

The output is sorted, so regenerating an unchanged manifest is a no-op in your
diff. The same file works in both places — pass it to the MCP server with
`--catalog`, or import it in `.storybook/preview.ts` as
`parameters.eventsInspector.catalog`.

### Setup CLI

The same command scaffolds the rest of the wiring:

```sh
npx storybook-events-inspector-setup          # all three steps
npx storybook-events-inspector-setup catalog  # just the catalog
npx storybook-events-inspector-setup mcp      # register the server in .mcp.json
npx storybook-events-inspector-setup skill    # write a .claude/skills skill
```

- **`mcp`** merges into an existing `.mcp.json` rather than replacing it,
  leaves any other servers alone, and won't re-register itself without
  `--force`. Takes `--storybook-url` and `--config`.
- **`skill`** writes `.claude/skills/storybook-events/SKILL.md` — the
  diagnostic loop, and what each flag implies as a fix (which of the four to
  believe first, and why an empty log after a click often isn't a bug). Skills
  aren't discoverable from `node_modules`, which is why it's written into your
  repo rather than shipped inside the package. Takes `--dir`.

Nothing is overwritten without `--force`, and every path it touches is printed.
Run `--help` for the full list.

### Tools

| Tool             | Does                                                                                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_stories`   | Every story in the running Storybook, so an agent can find an id without guessing.                                                                                                                                      |
| `open_story`     | Load a story by id and start capturing. Validates the id against the real index first — a typo'd id fails clearly instead of silently loading Storybook's own "not found" page.                                         |
| `click`          | Click a real element by CSS selector and let whatever it fires get captured naturally — "open the menu, see it respond," run by an agent instead of a human.                                                            |
| `dispatch_event` | The reverse direction: fire a synthetic event at the story's rendered element without a UI trigger to click. Also captured, like anything else.                                                                         |
| `get_events`     | Everything captured so far — name, the target that dispatched (a tag name, or `document`/`window`/an event bus class), detail, and the same flags the panel shows (`undocumented`/`shared`/`retargeted`/`notComposed`). |
| `clear_events`   | Empty the buffer without reloading the story.                                                                                                                                                                           |

Each tool's own `description` (what an agent actually reads to decide when to
use it) has more detail and an example than this table — see `src/mcp/server.ts`.
The server also sets top-level `instructions` summarizing the whole loop.

### Example loop

```
list_stories                                    → find "my-design-system--menu"
open_story  { storyId: "my-design-system--menu" }
click       { selector: "my-menu-trigger" }
get_events  {}
→ [{ name: "menu-open", origin: "my-menu", detail: {...}, undocumented: false, ... }]
```

Or the reverse direction — checking a component responds to a command event
without a UI trigger for it:

```
dispatch_event { name: "menu-close", detail: { reason: "escape" } }
get_events     {}
→ the dispatch itself, captured like anything else, plus whatever the
  component did in response
```

### Local development / testing it yourself

```sh
pnpm build
node dist/server.js --storybook-url http://localhost:6006
```

It speaks MCP over stdio — point an MCP client at that command, or use the
SDK's own `Client`/`StdioClientTransport` to script it directly, the same way
you'd script any other MCP server.

## Demo / local development

`src/demo/` is a self-contained pair of Lit fixtures (not part of the
published addon) used by this repo's own Storybook to exercise every flag and
the dispatch round-trip:

```sh
pnpm install
pnpm build          # compile src/manager.tsx, src/preview.ts → dist/
pnpm test           # unit tests for src/core/ (vitest + jsdom)
pnpm storybook      # http://localhost:6006 — see "Demo" in the sidebar
```

- **`Demo/Buttons`** — zero `eventsInspector` parameters. Both fixtures fire
  the shared `demo-change` name (flagged `shared`); shift-click the button to
  also fire `demo-secret`, which isn't in the catalog and still shows up,
  flagged `undocumented`.
- **`Demo/Narrowed`** — same fixtures, `filter: ['demo-change']` set, so
  `demo-secret` from a shift-click is captured but not shown.
- **`Demo/ScopedToCatalog`** — `catalogOnly: true`, deriving the same narrowing
  from the catalog's own names instead of a hand-maintained `filter` array.
- **`Demo/ToggleOnly`** — a single element alone in the canvas, for trying the
  panel's Dispatch form against it directly.

## Status

Young — the idea and the first release both landed the same week. `src/core/`
is covered by unit tests (`pnpm test`); the Storybook panel and the MCP server
are verified by hand against a real Storybook.

Known gaps, in the order they're worth closing:

- `safeDetail` flattens `Error`, `Map` and `Set` to `{}`, losing an error's
  message — the most useful thing a failing payload carries. (Placeholder
  tests are already in `src/core/safeDetail.test.ts`.)
- The panel keeps its log in `useAddonState`, which syncs the whole array over
  the manager/preview channel on every captured event. A manager-local store
  read by both the panel and its tab title would do the same job with no
  channel traffic.
- `peerDependencies` on `storybook` is `*` while the code imports
  `storybook/internal/*`; it should be pinned to the majors actually supported.
- Dev dependencies float on the `next` tag, so a fresh clone doesn't reproduce
  the committed lockfile.
- The MCP server and the Storybook panel ship as one package. They're siblings
  over the same `core/`, not parent and child, and splitting them would only
  buy back a zero-install `npx` invocation — worth revisiting if the server
  ever wants its own release cadence.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for dev
setup, how changes here actually get verified, and what's in/out of scope.

## License

[MIT](./LICENSE) © Drew Garman
