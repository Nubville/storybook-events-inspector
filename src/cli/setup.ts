/**
 * `npx storybook-events-inspector-setup [catalog|mcp|skill]`
 *
 * The three things a consumer otherwise does by hand: generate the event
 * catalog from their Custom Elements Manifest, register the MCP server, and
 * drop in a skill describing how to use it. Deliberately dependency-free
 * (`node:fs` and `node:path` only) so it stays in the main package without
 * reintroducing the install weight the optional peers just removed.
 *
 * Everything here writes into someone else's repo, so the rules are: never
 * overwrite without `--force`, merge rather than clobber structured config,
 * and say exactly which paths were touched.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { catalogFromManifest, ManifestError } from './manifest';
import { SKILL_CONTENT, SKILL_NAME } from './skill';

const DEFAULT_CATALOG_OUT = 'events-catalog.json';
const DEFAULT_STORYBOOK_URL = 'http://localhost:6006';

interface Options {
  readonly manifest?: string;
  readonly out?: string;
  readonly storybookUrl?: string;
  readonly config?: string;
  readonly dir?: string;
  readonly force: boolean;
}

function parseArgs(argv: readonly string[]): { command: string; options: Options } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--force' || arg === '-f') force = true;
    else if (arg === '--help' || arg === '-h') flags.help = 'true';
    else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = 'true';
      else flags[key] = argv[++i]!;
    } else positional.push(arg);
  }

  return {
    command: flags.help ? 'help' : (positional[0] ?? 'all'),
    options: {
      manifest: flags.manifest,
      out: flags.out,
      storybookUrl: flags['storybook-url'],
      config: flags.config,
      dir: flags.dir,
      force,
    },
  };
}

const log = (message: string): void => void process.stdout.write(`${message}\n`);
const warn = (message: string): void => void process.stderr.write(`${message}\n`);
const show = (path: string): string => relative(process.cwd(), path) || path;

/**
 * Where a Custom Elements Manifest actually lives. `package.json`'s
 * `customElements` field is the CEM spec's own pointer and the only
 * authoritative answer, so it wins; the rest are conventional fallbacks for
 * projects that never set it.
 */
function findManifest(explicit: string | undefined): string {
  if (explicit) {
    const path = resolve(process.cwd(), explicit);
    if (!existsSync(path)) throw new ManifestError(`No manifest at ${show(path)}.`);
    return path;
  }

  const packageJsonPath = resolve(process.cwd(), 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { customElements?: string };
      if (pkg.customElements) {
        const path = resolve(process.cwd(), pkg.customElements);
        if (existsSync(path)) return path;
      }
    } catch {
      // A malformed package.json isn't this tool's problem; fall through.
    }
  }

  for (const candidate of ['custom-elements.json', 'dist/custom-elements.json', 'custom-elements-manifest.json']) {
    const path = resolve(process.cwd(), candidate);
    if (existsSync(path)) return path;
  }

  throw new ManifestError(
    'No Custom Elements Manifest found.\n' +
      'Looked at package.json#customElements, ./custom-elements.json,\n' +
      './dist/custom-elements.json and ./custom-elements-manifest.json.\n' +
      'Pass one explicitly:  --manifest path/to/custom-elements.json',
  );
}

function writeFile(path: string, contents: string, force: boolean): boolean {
  if (existsSync(path) && !force) {
    warn(`  skipped ${show(path)} (already exists — pass --force to overwrite)`);
    return false;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  return true;
}

function runCatalog(options: Options): string | undefined {
  const manifestPath = findManifest(options.manifest);
  const catalog = catalogFromManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));

  if (catalog.length === 0) {
    warn(`  ${show(manifestPath)} declares no events — nothing to write.`);
    warn('  (Does your manifest generator emit `events` for your elements?)');
    return undefined;
  }

  const outPath = resolve(process.cwd(), options.out ?? DEFAULT_CATALOG_OUT);
  // The catalog is derived, so regenerating it is always safe — no --force.
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`);

  const shared = catalog.filter((entry) => entry.tags.length > 1);
  const tags = new Set(catalog.flatMap((entry) => entry.tags));
  log(`  wrote ${show(outPath)} — ${catalog.length} event(s) across ${tags.size} element(s)`);
  if (shared.length > 0) {
    log(`  ${shared.length} shared name(s), which will be flagged: ${shared.map((e) => e.name).join(', ')}`);
  }
  return outPath;
}

function runMcp(options: Options, catalogPath?: string): void {
  const configPath = resolve(process.cwd(), options.config ?? '.mcp.json');

  let config: { mcpServers?: Record<string, unknown> } = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8')) as typeof config;
    } catch {
      warn(`  ${show(configPath)} isn't valid JSON — not touching it.`);
      return;
    }
  }

  const servers = (config.mcpServers ??= {});
  if (servers['storybook-events-inspector'] && !options.force) {
    warn(`  skipped ${show(configPath)} (storybook-events-inspector already registered — pass --force)`);
    return;
  }

  const args = ['storybook-events-inspector-mcp', '--storybook-url', options.storybookUrl ?? DEFAULT_STORYBOOK_URL];
  const catalog = catalogPath ?? resolve(process.cwd(), DEFAULT_CATALOG_OUT);
  if (existsSync(catalog)) args.push('--catalog', `./${show(catalog)}`);

  // `npx` rather than the bare bin name: the bin is linked into
  // node_modules/.bin, which isn't on PATH, so a client spawning the bare name
  // fails with ENOENT. npx resolves node_modules/.bin first and, since the
  // package is already installed locally, downloads nothing.
  servers['storybook-events-inspector'] = { command: 'npx', args };

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  log(`  wrote ${show(configPath)} — registered the MCP server`);
  if (!args.includes('--catalog')) {
    log('  (no catalog found, so shared/undocumented will be inert — run the catalog step first)');
  }
}

function runSkill(options: Options): void {
  const skillPath = resolve(process.cwd(), options.dir ?? '.claude/skills', SKILL_NAME, 'SKILL.md');
  if (writeFile(skillPath, SKILL_CONTENT, options.force)) {
    log(`  wrote ${show(skillPath)}`);
  }
}

const HELP = `storybook-events-inspector-setup [command] [options]

Commands:
  catalog   Generate the event catalog from your Custom Elements Manifest
  mcp       Register the MCP server in .mcp.json (merges; won't clobber)
  skill     Write a .claude/skills skill for debugging component events
  all       All three (default)

Options:
  --manifest <path>       Manifest to read (default: package.json#customElements,
                          then ./custom-elements.json)
  --out <path>            Catalog output (default: ${DEFAULT_CATALOG_OUT})
  --storybook-url <url>   Storybook URL for the MCP config (default: ${DEFAULT_STORYBOOK_URL})
  --config <path>         MCP config file (default: .mcp.json)
  --dir <path>            Skills directory (default: .claude/skills)
  --force, -f             Overwrite files that already exist
  --help, -h              This message
`;

function main(): void {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (command === 'help') {
    log(HELP);
    return;
  }
  if (!['catalog', 'mcp', 'skill', 'all'].includes(command)) {
    warn(`Unknown command "${command}".\n`);
    warn(HELP);
    process.exit(1);
  }

  try {
    let catalogPath: string | undefined;

    if (command === 'catalog' || command === 'all') {
      log('catalog:');
      // In `all`, a missing manifest shouldn't sink the other two steps —
      // the MCP server and the skill are useful with no catalog at all.
      try {
        catalogPath = runCatalog(options);
      } catch (error) {
        if (command === 'catalog' || !(error instanceof ManifestError)) throw error;
        warn(`  ${error.message.split('\n')[0]}`);
        warn('  Skipping the catalog; run `… catalog --manifest <path>` once you have one.');
      }
    }
    if (command === 'mcp' || command === 'all') {
      log('mcp:');
      runMcp(options, catalogPath);
    }
    if (command === 'skill' || command === 'all') {
      log('skill:');
      runSkill(options);
    }
  } catch (error) {
    warn(`\n${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
