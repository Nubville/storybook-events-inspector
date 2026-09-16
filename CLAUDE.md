# CLAUDE.md

Project-specific operating notes that aren't obvious from the code alone.

## Releasing

There is no working automated release yet. `auto shipit` (via `pnpm run release`)
almost always computes `none`/no bump right now — don't trust that output.

Root cause: `auto`'s conventional-commits → SEMVER-bump pipeline expects PRs to get
auto-labeled by a CI workflow on merge, and that workflow has never actually run
here (see "CI workflow files" below — they're not on GitHub yet). Every version
bump from 0.1.0 through 0.3.1 was a **manual** edit to `package.json`, not a real
`auto` run. A `v0.3.1` GitHub Release was backfilled by hand at commit `b8ae224`
(the commit that introduced that version string) purely so `auto` has *a* baseline
to diff from — it still won't compute correct bumps until PR auto-labeling works.

Until the workflow gap is fixed, release manually:
1. Check `git log <last-version-commit>..HEAD` yourself and pick the bump by hand
   using standard semver (this repo's own history treats `feat:` as minor,
   `fix:`/`perf:`/`chore:` as patch, even pre-1.0 — not the "0.x collapses
   everything" convention).
2. Hand-edit `version` in `package.json`.
3. `pnpm build && pnpm test`.
4. `npm publish` (confirm `npm whoami` is logged in first).
5. `git tag vX.Y.Z && git push --tags`, and `gh release create vX.Y.Z` with real
   notes, so the next release has a correct baseline.
6. Before assuming "nothing to publish," diff HEAD against the **actual npm
   registry version** (`npm view storybook-events-inspector version`), not just
   `package.json` — they can and have drifted apart from unpublished work sitting
   on `main`.

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
