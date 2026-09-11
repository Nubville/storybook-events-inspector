/**
 * A standalone MCP server — separate from Storybook's own `@storybook/addon-mcp`,
 * which (as of writing) has no third-party extension point and whose docs
 * toolset doesn't cover web-components projects yet. This exposes exactly
 * this addon's domain instead: capture and dispatch, for an agent to prove a
 * component fires (or responds to) the right event, the same loop the
 * Storybook panel gives a human.
 *
 * Usage: wc-custom-events-mcp [--storybook-url <url>] [--catalog <path.json>]
 */
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import type { EventCatalogEntry } from '../core/types';
import { Session } from './session';

function parseArgs(argv: readonly string[]): { storybookUrl: string; catalogPath?: string } {
  let storybookUrl = 'http://localhost:6006';
  let catalogPath: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--storybook-url' && argv[i + 1]) storybookUrl = argv[++i]!;
    else if (argv[i] === '--catalog' && argv[i + 1]) catalogPath = argv[++i];
  }
  return { storybookUrl, catalogPath };
}

function loadCatalog(catalogPath: string | undefined): readonly EventCatalogEntry[] {
  if (!catalogPath) return [];
  const parsed: unknown = JSON.parse(readFileSync(catalogPath, 'utf-8'));
  if (!Array.isArray(parsed)) throw new Error(`${catalogPath} must contain a JSON array of { name, tags } entries.`);
  return parsed as EventCatalogEntry[];
}

const { storybookUrl, catalogPath } = parseArgs(process.argv.slice(2));
const catalog = loadCatalog(catalogPath);
const session = new Session(storybookUrl, catalog);

const server = new McpServer(
  { name: 'wc-custom-events', version: '0.1.0' },
  {
    instructions: `Debug a web component's custom events against a running Storybook (default ${storybookUrl}).

Typical loop:
1. list_stories — find the story you want (or the caller already knows the id).
2. open_story — load it in a real browser; this also clears any previous events.
3. click a selector, OR dispatch_event to fire something at the component directly.
4. get_events — see exactly what fired: name, the tag that dispatched it, and its
   detail payload, flagged the same way the Storybook panel flags them:
     - undocumented: not in the catalog this server was started with (--catalog)
     - shared: this event name is also declared by another tag
     - retargeted: event.target isn't the true origin (composed event crossed a shadow boundary)
     - notComposed: dispatched without composed:true — invisible outside its shadow root,
       to the whole host app, not just this tool. Usually the bug worth fixing first.

Capture is complete by default — every custom event the component dispatches shows up,
whether or not it's in the catalog. No catalog is required to use this; it only adds the
shared/undocumented distinction.`,
  },
);

server.registerTool(
  'list_stories',
  {
    title: 'List stories',
    description:
      'List every story in the running Storybook, so you can find a story id for open_story without guessing.',
    inputSchema: {},
  },
  async () => {
    const stories = await session.listStories();
    return { content: [{ type: 'text', text: JSON.stringify(stories, null, 2) }] };
  },
);

server.registerTool(
  'open_story',
  {
    title: 'Open a story',
    description:
      'Load a story by id in a real (headless) browser and start capturing every custom event it dispatches from here on. Clears any previously captured events. Call this before click, dispatch_event, or get_events.',
    inputSchema: { storyId: z.string().describe("A story id from list_stories, e.g. 'demo--buttons'.") },
  },
  async ({ storyId }) => {
    await session.openStory(storyId);
    return { content: [{ type: 'text', text: `Opened ${storyId}. Capturing events.` }] };
  },
);

server.registerTool(
  'click',
  {
    title: 'Click an element',
    description:
      'Click a real element in the open story via a CSS selector (e.g. a menu trigger) and let the resulting custom event(s) get captured naturally — the same "open the menu, see it respond" loop a human runs by hand. Check what fired with get_events afterward.',
    inputSchema: { selector: z.string().describe("A CSS selector, e.g. 'demo-toggle' or '.menu-trigger'.") },
  },
  async ({ selector }) => {
    await session.click(selector);
    return { content: [{ type: 'text', text: `Clicked ${selector}.` }] };
  },
);

server.registerTool(
  'dispatch_event',
  {
    title: 'Dispatch a synthetic event',
    description:
      "The reverse direction: fire a synthetic event *at* the story's rendered custom element (found automatically, not necessarily the canvas's first child), to check it responds the way its docs claim — without a real UI trigger to click. The dispatch itself is also captured, same as anything else, so it shows up in the next get_events call too.",
    inputSchema: {
      name: z.string().describe("Event name, e.g. 'item-command'."),
      detail: z.unknown().optional().describe('JSON detail payload for the event, if any.'),
      bubbles: z.boolean().optional().default(true),
      composed: z.boolean().optional().default(true),
    },
  },
  async ({ name, detail, bubbles, composed }) => {
    const result = await session.dispatch(name, { detail, bubbles, composed });
    return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: !result.ok };
  },
);

server.registerTool(
  'get_events',
  {
    title: 'Get captured events',
    description:
      'Everything captured in the open story so far, newest last: name, the tag that actually dispatched it, its detail, and flags (undocumented/shared/retargeted/notComposed). Pass sinceSeq (from a previous response) to get only what arrived after it.',
    inputSchema: { sinceSeq: z.number().optional().describe('Only return events with seq greater than this.') },
  },
  async ({ sinceSeq }) => {
    const events = session.getEvents(sinceSeq);
    return { content: [{ type: 'text', text: JSON.stringify(events, null, 2) }] };
  },
);

server.registerTool(
  'clear_events',
  {
    title: 'Clear captured events',
    description: 'Empty the captured-events buffer for the open story without reloading it.',
    inputSchema: {},
  },
  async () => {
    session.clearEvents();
    return { content: [{ type: 'text', text: 'Cleared.' }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

async function shutdown(): Promise<void> {
  await session.close();
  process.exit(0);
}

// SIGINT: Ctrl-C in a terminal. SIGTERM: how a process manager / MCP client
// host normally asks a child to stop. Both need the browser closed explicitly
// — it's a real subprocess, not something the OS reclaims automatically.
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
