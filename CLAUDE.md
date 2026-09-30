# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Homey (Athom smart-home hub) SDK v3 app `nl.stefanrenne.tasks`: a to-do list driven by Homey Flows, a settings page, and a dashboard widget. TypeScript as ES modules (`.mts`, imported with `.mjs` extensions), Node 22, `platforms: ["local"]`.

## Commands

```bash
npm run build      # tsc → .homeybuild/
npm run lint       # eslint on **/*.mts
homey app validate --level verified   # what CI runs (requires Homey CLI)
homey app run      # run on a Homey for development (requires Homey CLI)
```

There is no test suite.

## Outstanding work

**`TODO.md` (repo root) is the single source of truth for what's left to do.** Check it at the start of each session. It lists every outstanding bug, cleanup and feature, with status markers. Finished items are archived with their full context (root causes, gotchas, verification notes) in `COMPLETED.md`. Check there before re-investigating anything that sounds familiar.

When you find a bug or loose end that you're not fixing right now, add it to `TODO.md`. When you finish an item, move it to `COMPLETED.md` in the same change. The "Known issues" sections in `docs/` describe current behaviour; `TODO.md` tracks the fix. Update both.

## Reference docs

Detailed reference lives in `docs/`. Read the relevant file before changing that area:

- [docs/data-model.md](docs/data-model.md): the Task schema, the state lifecycle, identifier/item upsert rules, and which triggers and realtime events each `Store` method fires.
- [docs/flow-cards.md](docs/flow-cards.md): every action, condition and trigger card, with its args, tokens and behaviour, plus autocomplete.
- [docs/web-api.md](docs/web-api.md): app and widget HTTP routes, the realtime event, and the settings and widget frontends.
- [docs/settings-page.md](docs/settings-page.md): the settings page tabs, list actions per task state, the create form fields and validation, and known issues.
- [docs/widget.md](docs/widget.md): the dashboard widget's files, settings, rendering and completion behaviour.
- [docs/history.md](docs/history.md): how the architecture evolved (the 1.x settings store → the 2.0 NeDB rewrite) and why some things look the way they do.

**Every change must update `docs/`.** In the same change as the code, update the affected `docs/*.md`. If the change introduces an area that no existing file covers, create a new `docs/<topic>.md` and add it to the list above. Docs describe current behaviour, not history (history goes in `.homeychangelog.json`). A change is not done until the docs match the code.

## User-facing docs: keep them in sync with feature changes

The files below describe the app to end users. They **must be updated whenever a user-visible feature changes**, for example a new flow card, a new setting or widget option, new UI in the settings page, or changed behaviour:

- `README.md` is the full GitHub-facing doc: what the app does, the Flow cards, the settings page, the widget and its settings, and how identifiers, items, tags, locking and scheduling work. `docs/` is the developer reference; README.md is the user-facing explanation.
- `README.txt` is the Homey App Store description, and `README.{de,nl,no,sv}.txt` are its translations. Plain text, no markdown, non-technical, and consistent with README.md. **Keep it very short: two paragraphs on the core value proposition (automatically managed to-do list from Flows, plus the widget), then the closing community pointer.** Do NOT grow it into feature lists: no per-card breakdowns, settings detail, requirements or how-to steps. All of that belongs in README.md. App Store Guidelines 1.3 reject descriptions that accumulate those sections. When a new feature lands, update README.md and leave the README*.txt files alone unless the core pitch itself changed. If it did, update all five languages together.

When finishing a feature, check both before committing.

## Homey Compose: never edit `app.json` directly

The root `app.json` is **generated** by the Homey CLI from `.homeycompose/app.json`, `.homeycompose/flow/{actions,conditions,triggers}/*.json`, and `widgets/*/widget.compose.json`. Make manifest changes in those source files. The `api` section (HTTP routes for `api.mts`) lives in `.homeycompose/app.json`. For version bumps, see [Releasing](#releasing).

Note: a flow card's `id` inside the JSON is what the code uses, not the filename (e.g. `get_tasks.json` has id `get_all`).

## Architecture

- **`lib/storage.mts` — `Store`**: the single data layer, a NeDB datastore at `/userdata/tasks-v1.db`. Every mutation fires the relevant flow triggers (`on_create`, `on_update`, `on_complete`) and emits the realtime event `didUpdateTasks`, which the settings page and widget listen to for refreshes. Put new mutations here so triggers and realtime updates stay consistent.
- **`app.mts` — `TasksApp`**: registers run listeners and autocomplete listeners for all flow cards, and runs a per-minute timer (`processFutureTasks`) that promotes `future` tasks to `open`.
- **`api.mts`**: app Web API used by `settings/index.html` (`GET /tasks` is public). **`widgets/list-tasks/api.mts`**: a separate, narrower API for the dashboard widget (`widgets/list-tasks/public/index.html`). Both reach the store through `(homey.app as TasksApp).store`.

### Task model semantics

- `state`: `open` | `future` (scheduled, date in the future, rounded to the minute) | `completed` (soft-completed; `deleteTasks` removes rows, but still fires `on_complete`).
- `identifier` + optional `item` form an upsert key: creating a task whose identifier(/item) matches an existing open task updates its title (firing `on_update`, or nothing if the title is unchanged) rather than inserting. The same merge happens when a future task matures into an existing open one.
- `item` filtering uses `$where: function () { return !item || this.item === item }` — a missing item matches all items for that identifier. `$where` must be a `function` (not an arrow) because NeDB binds `this` to the candidate task; `TaskQuery` types this.
- Most flow cards come in pairs (`xxx_task` / `xxx_task_item`) that share one listener.

### Autocomplete

`allIdentifiers` / `allTags` on `TasksApp` are caches built from the argument values of every flow card that has an `identifier`/`tag` arg, plus values from existing tasks. They are refreshed when a card's args change (`card.on('update')`) and when the API calls `/identifiers` or `/tags`.

## Translations

Supported languages: en, nl, de, no, sv. User-facing strings live in `locales/*.json`, in every language key of each `.homeycompose` flow card / app / widget JSON, and in `README.{lang}.txt`. When adding or changing a card or string, update all languages. The `homey-translate` skill covers adding a new language.

## Releasing

**Every publication needs a new version number.** The version lives in **three** places, and all three must be bumped together:

1. `.homeycompose/app.json` is the source of truth. Everything else follows it.
2. `app.json` is generated. Refresh it with `homey app build` after step 1 and commit the regenerated file.
3. `package.json` is **purely cosmetic, so keep it in sync by hand.** Nothing reads it: the Homey CLI only uses the dependency list, and no app code reads a version. It once drifted to `1.0.0` while the app was at `2.0.0`, because `homey app publish` and the version workflow bump the manifest and never touch it. Edit the field directly, along with the two root `version` fields at the top of `package-lock.json`. Do NOT run `npm version`, which also creates a commit and a git tag.

Then add the release's entry to `.homeychangelog.json`. Use user-facing wording that describes what changed for the user, not the commit subjects, and skip anything that only touches docs. Run `homey app validate --level publish` before committing.

The `Update Homey App Version` GitHub workflow (`workflow_dispatch` with major/minor/patch plus a changelog) can do steps 1, 2 and the changelog for you. It also commits, tags `vX.Y.Z` and creates a GitHub release. It does **not** update `package.json`. `Publish Homey App` is a separate manual workflow.

Each published version stands on its own. `homey app publish` uploads it as a **test** version that is reachable only by its own link, and **certifying it promotes that version to live**, auto-updating every existing install. The standing plan is to certify every publication, so treat a publish as "this is going to all users shortly" rather than as a private build. Publishing never overwrites anything: an older version is superseded only when a newer one is certified.
