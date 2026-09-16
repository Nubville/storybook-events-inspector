# CLAUDE.md

Project-specific operating notes that aren't obvious from the code alone.

## Releasing

`auto shipit` (via `pnpm run release`) needs `GH_TOKEN` set — `export
GH_TOKEN=$(gh auth token)` works locally. Two real things had to be fixed before
it would compute a correct bump at all; both are now fixed, but the second one
is a standing constraint on how you use it, not a one-time bug:

1. **Version mismatch (fixed).** `auto` (the CLI) was pinned to `11.3.0` while
   `@auto-it/conventional-commits`/`@auto-it/released` were pinned to `11.3.6`,
   so two separate copies of `@auto-it/core` existed in the tree. All three are
   now pinned to `^11.3.6` — verify with `pnpm why @auto-it/core` (should show
   exactly one resolved version) before trusting a bump calculation again.

2. **`calculateSemVerBump` only inspects the single most-recent commit to decide
   whether to skip the release entirely** (`@auto-it/core`'s `semver.js`) — it's
   built for "one `shipit` run per merged PR," where the latest PR's label is
   the whole signal. It still aggregates the highest bump across every commit
   since the last release once it decides not to skip, but if HEAD's own commit
   type maps to the `skip-release` label (`chore:`, `docs:` in this plugin's
   mapping), the whole run computes `none` — even with a real `feat:`/`fix:`
   sitting a few commits back. **Before running a release after a batch of
   commits, make sure HEAD itself is a `feat:`/`fix:`/`perf:` commit** (or land
   one last such commit right before releasing) — don't trust a `none` result
   at face value without checking what HEAD's own commit type is first.

There was also no real release history before this was debugged: no git tags, no
GitHub Releases, no `CHANGELOG.md` — every bump from 0.1.0 through 0.3.1 was a
manual `package.json` edit. A `v0.3.1` GitHub Release was backfilled by hand at
commit `b8ae224` (the commit that introduced that version string) so `auto` has
a real baseline to diff from going forward.

Before assuming "nothing to publish," diff HEAD against the **actual npm
registry version** (`npm view storybook-events-inspector version`), not just
`package.json` — they can and have drifted apart from unpublished work sitting
on `main`.

Separately, `.github/workflows/*.yml` still isn't live on GitHub (see below), so
none of this runs in CI yet — `pnpm run release` has to be triggered by hand
until that's fixed.

## Local dev server

The demo Storybook (`pnpm storybook`) loads this addon from its **built**
`dist/manager.js` / `dist/preview.js` (see `.storybook/local-preset.ts`), not live
`src/`. Editing `src/` and refreshing the browser will silently do nothing until
`dist/` is rebuilt. Either run `pnpm start` (which runs `build:watch` +
`storybook` together) instead of bare `pnpm storybook`, or manually `pnpm build`
after every edit before checking it live.

## `pnpm remove` on a peer dependency

`playwright`, `@modelcontextprotocol/sdk`, and `zod` are intentionally listed in
**both** `devDependencies` and `peerDependencies` (as optional peers) — the
Storybook-panel-only install path stays lightweight, but local dev/test still
needs them. Running `pnpm remove <pkg>` strips it from both sections at once
since it's the same package name. If you need to reinstall/update one of these,
edit `package.json` directly (keep it in both places) and run `pnpm install` —
don't use `pnpm remove`/`pnpm add` on them.

## `gh` CLI can't push workflow files

The authenticated `gh`/git token here lacks the `workflow` OAuth scope, so any
push touching `.github/workflows/*.yml` is rejected. Workaround used repeatedly:
`git rm --cached` those files, commit, push, leave them present but untracked
locally. This needs `gh auth refresh -s workflow` (a real user action, not
something scriptable from here) to actually resolve — until then, CI (including
the release-labeling automation above) does not run on GitHub at all.

## Verifying UI changes

The IDE's TypeScript diagnostics have repeatedly been stale/wrong for files in
`src/components/` (falsely flagging real exports from `storybook/internal/components`
as missing). Trust a real `npx tsc --noEmit -p tsconfig.json` run over the IDE
hint. For behavior (not just types), drive the actual running dev server with a
throwaway Playwright script rather than reading source and assuming — this repo's
history includes more than one case where confident-sounding assumptions about
Storybook's manager APIs (e.g. the `active` render prop on a panel) were simply
wrong.
