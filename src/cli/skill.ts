/**
 * The skill this CLI writes into a consumer's repo.
 *
 * A skill file rather than more MCP `instructions` because the two carry
 * different things. The server's tool descriptions say what each tool does,
 * travel to every MCP client, and are the right home for anything mechanical.
 * What they can't carry is the part that touches the *repo* — reading the
 * manifest, editing a component's dispatch, regenerating the catalog — and
 * the part that's diagnosis rather than description: which flag to believe
 * first, and what each one actually implies as a fix.
 *
 * Written into the user's project rather than shipped inside this package
 * because skills aren't discoverable from node_modules.
 */
export const SKILL_NAME = 'storybook-events';

export const SKILL_CONTENT = `---
name: ${SKILL_NAME}
description: Debug custom events dispatched by web components in Storybook — prove what a component fires (or responds to), and diagnose events that never reach the host app. Use when a component's event isn't arriving, when checking an event's detail payload, when auditing a design system's events against its manifest, or when asked to verify a component's event API.
---

# Debugging web component events

Uses the \`storybook-events-inspector\` MCP server against a running Storybook.
Storybook must already be running — the server drives a separate headless
browser against it and will not start it for you.

## The loop

1. \`list_stories\` — find the story id. Don't guess ids; a typo fails loudly
   but costs a round trip.
2. \`open_story\` — loads it and starts capturing. It reports how many events
   fired during render, and a \`sinceSeq\` cursor.
3. Provoke the event: \`click\` a real selector (the honest path — it exercises
   what a user does), or \`dispatch_event\` to fire one *at* the component when
   there's no UI trigger for it.
4. \`get_events\` — what actually fired.

Pass \`sinceSeq\` from the previous response to see only what's new. Sequence
numbers increase for the life of the server, so a cursor stays valid across
\`open_story\` calls.

## Reading the flags

The flags are the point of the tool. Each implies a different fix:

- **\`notComposed\`** — believe this one first. The event was dispatched from
  inside a shadow root without \`composed: true\`, so it never left that root.
  It is invisible to the *entire host app*, not just this tool. This is almost
  always the bug when someone says "my listener never fires." Fix at the
  dispatch site: \`new CustomEvent(name, { bubbles: true, composed: true })\`.
- **\`retargeted\`** — the event crossed a shadow boundary, so \`event.target\`
  in a host listener is the outer host element, not the thing that dispatched.
  Not a bug in itself, but it breaks host code that reads \`event.target\` to
  decide which control fired. Point the host at \`event.composedPath()[0]\`, or
  put the identifying information in \`detail\`.
- **\`shared\`** — more than one tag declares this event name, so a listener on
  a common ancestor can't tell which one fired. Check \`sharedWith\`. Either
  disambiguate via the origin/detail, or rename if the two events aren't
  really the same event.
- **\`undocumented\`** — fired but not in the catalog. Either it's missing from
  the manifest (add it), or it's incidental and nothing should depend on it.
  With no \`--catalog\` configured, *everything* reads undocumented and the flag
  means nothing — check that before drawing conclusions from it.

## Things that will otherwise waste your time

- **Native events never appear, by design.** A real click, focus or input is
  dispatched by the browser engine, not through a JS \`.dispatchEvent()\` call.
  If you clicked and \`get_events\` is empty, that is not necessarily a bug —
  it means the component dispatched nothing of its own.
- **Only hyphenated event names are captured**, matching the platform's custom
  event naming convention. An event named \`change\` is filtered as native noise.
- **Capture covers every \`EventTarget\`**, not just elements — \`document\`,
  \`window\`, and event-bus classes show up with \`origin\` as \`document\`,
  \`window\`, or the class name.
- **A dispatch you send is captured too**, like anything else. Don't mistake
  your own \`dispatch_event\` in the log for the component reacting.

## Catalog

\`shared\` and \`undocumented\` only mean anything with a catalog. It is generated
from the Custom Elements Manifest, never hand-written:

\`\`\`sh
npx storybook-events-inspector-setup catalog
\`\`\`

Regenerate it after changing any component's declared events, then re-run the
loop to confirm the drift is gone.

## Auditing a component's event API

To check a component's real behaviour against what it documents: regenerate
the catalog, \`open_story\` the component's story, exercise each interaction
with \`click\`, and \`get_events\`. Anything flagged \`undocumented\` is drift —
either the manifest is stale or the component is firing something it
shouldn't. Anything the manifest declares that never appears is either
untested by that story or not implemented.
`;
