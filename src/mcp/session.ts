/**
 * Drives one story at a time in a headless browser, using the SAME
 * `core/browser-bundle.ts` the Storybook panel is built on — injected
 * directly into the story's `iframe.html`, bypassing the Storybook manager
 * and channel entirely. Catalog-based annotation (`shared`/`undocumented`)
 * happens here, server-side, the same way the Storybook Panel component does
 * it — `core/catalog.ts` is shared by both.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';

import { indexCatalog } from '../core/catalog';
import type { DispatchOptions, DispatchResult, EventCatalogEntry, LogEntry } from '../core/types';

declare global {
  interface Window {
    /** Bound via page.exposeFunction — proxies a captured entry back to the Node session. */
    __reportEntry?: (entry: LogEntry) => void;
  }
}

export interface AnnotatedLogEntry extends LogEntry {
  readonly shared: boolean;
  readonly undocumented: boolean;
  readonly sharedWith: readonly string[];
}

export interface StoryIndexEntry {
  readonly id: string;
  readonly title: string;
  readonly name: string;
  readonly type: string;
}

// Built by tsup as its own flat entry (see tsup.config.ts's browserEntries) and
// lands next to server.js — this file's own code gets inlined into dist/server.js
// (it's not a separate tsup entry), so import.meta.url here IS server.js's URL.
const BROWSER_BUNDLE_PATH = fileURLToPath(new URL('./browser-bundle.global.js', import.meta.url));

export class Session {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private entries: AnnotatedLogEntry[] = [];
  private currentStoryId: string | null = null;
  private readonly byName: ReadonlyMap<string, readonly string[]>;

  constructor(
    private readonly storybookUrl: string,
    private readonly catalog: readonly EventCatalogEntry[],
    private readonly maxEntries = 500,
  ) {
    this.byName = indexCatalog(catalog);
  }

  private annotate(entry: LogEntry): AnnotatedLogEntry {
    const tags = this.byName.get(entry.name);
    return {
      ...entry,
      undocumented: !tags,
      shared: (tags?.length ?? 0) > 1,
      sharedWith: (tags ?? []).filter((tag) => tag !== entry.origin),
    };
  }

  private async getPage(): Promise<Page> {
    if (this.page) return this.page;
    this.browser = await chromium.launch();
    const page = await this.browser.newPage();
    // Registered once; Playwright re-applies both on every subsequent
    // navigation within this page, so openStory() doesn't need to redo them.
    await page.exposeFunction('__reportEntry', (entry: LogEntry) => {
      this.entries.push(this.annotate(entry));
      if (this.entries.length > this.maxEntries) this.entries.splice(0, this.entries.length - this.maxEntries);
    });
    await page.addInitScript({ content: readFileSync(BROWSER_BUNDLE_PATH, 'utf-8') });
    this.page = page;
    return page;
  }

  async listStories(): Promise<StoryIndexEntry[]> {
    const res = await fetch(new URL('index.json', this.storybookUrl));
    if (!res.ok) {
      throw new Error(`Couldn't reach ${this.storybookUrl} (index.json → ${res.status}). Is Storybook running?`);
    }
    const index = (await res.json()) as { entries: Record<string, StoryIndexEntry> };
    return Object.values(index.entries).filter((entry) => entry.type === 'story');
  }

  async openStory(storyId: string): Promise<void> {
    // iframe.html always resolves (200) even for an id that doesn't exist —
    // Storybook renders its own "story not found" UI client-side rather than
    // failing the navigation, so silently "succeeding" on a typo'd id is a
    // real trap here. Check against the real index first for a clear error.
    const known = await this.listStories();
    if (!known.some((entry) => entry.id === storyId)) {
      const suggestions = known
        .map((entry) => entry.id)
        .filter((id) => id.includes(storyId) || storyId.includes(id))
        .slice(0, 5);
      throw new Error(
        `No story with id "${storyId}". ` +
          (suggestions.length ? `Did you mean: ${suggestions.join(', ')}?` : 'Call list_stories to see valid ids.'),
      );
    }

    const page = await this.getPage();
    const url = new URL('iframe.html', this.storybookUrl);
    url.searchParams.set('id', storyId);
    url.searchParams.set('viewMode', 'story');
    await page.goto(url.toString(), { waitUntil: 'networkidle' });

    this.currentStoryId = storyId;
    this.entries = [];
    await page.evaluate(() => {
      window.__eventsInspector?.start((entry) => window.__reportEntry?.(entry));
    });
  }

  private requireStoryOpen(): string {
    if (!this.currentStoryId) throw new Error('No story open — call open_story first.');
    return this.currentStoryId;
  }

  getEvents(sinceSeq?: number): AnnotatedLogEntry[] {
    this.requireStoryOpen();
    return sinceSeq === undefined ? this.entries : this.entries.filter((entry) => entry.seq > sinceSeq);
  }

  clearEvents(): void {
    this.requireStoryOpen();
    this.entries = [];
  }

  async click(selector: string): Promise<void> {
    this.requireStoryOpen();
    const page = await this.getPage();
    await page.click(selector, { timeout: 10_000 });
  }

  async dispatch(name: string, options: DispatchOptions): Promise<DispatchResult> {
    this.requireStoryOpen();
    const page = await this.getPage();
    const result = await page.evaluate(
      (args: { name: string; options: DispatchOptions }) => window.__eventsInspector?.dispatch(args.name, args.options),
      { name, options },
    );
    // Give the capture-side exposeFunction round-trip a moment before the
    // caller immediately calls get_events expecting to see this dispatch.
    await page.waitForTimeout(50);
    return result ?? { ok: false, error: 'Bridge not present on the page — was open_story called first?' };
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
    this.page = null;
  }
}
