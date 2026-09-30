# Completed

Archive of finished [TODO.md](TODO.md) items and past fixes, newest first. Keep the context: root cause, gotchas, and how it was verified. Commit hashes refer to this repo. For how the architecture evolved, see [docs/history.md](docs/history.md).

## 2026-09-30

- **`package.json` version drift.** `package.json` and the root entries of `package-lock.json` said `1.0.0` while the app was `2.0.0`. Root cause: `homey app publish` and the `Update Homey App Version` workflow only bump `.homeycompose/app.json` / `app.json`. Nothing reads `package.json`'s version, so the drift was cosmetic. Synced by hand to `2.0.0`. The Releasing section in CLAUDE.md now says to bump it on every release, and not to use `npm version` (it creates a commit and a tag).

## 2.0.x follow-ups (after the 2.0.0 bump, not yet re-versioned)

- **Deleting a task didn't fire `on_complete`** (`2659f48`, 2026-09-13). `deleteTasks` called `removeAsync` directly. It now finds the matches first and triggers `on_complete` per task, the same as `completeTasks`. At the same time, `on_complete` gained a `future` boolean token, so Flows can tell a cancelled scheduled task from a completed open one.
- **Identifier autocomplete missed future tasks** (`013191e`, 2026-09-13). `updateAllIdentifiers` queried only `state: 'open'`, so an identifier used only by a scheduled task didn't show up in autocomplete. It now includes every non-completed task. `updateAllTags` still only looks at open tasks.
- **`GET /tasks` made public, `future` param replaced by `state`** (`498f31f`, 2026-09-13). Both APIs now take `state` (a string, or an array via `state[0]`, `state[1]`) instead of `future=true|false`. This commit introduced the operator-precedence bug where calling without `state` crashes (see [TODO.md](TODO.md)).
- **Scheduling the same task twice created duplicates** (`e3dd926`, 2026-08-04). `createTask` always inserted future tasks. Future dates are now truncated to the minute, and an existing future task with the same identifier(/item) **and the same minute** has its title updated instead. Scheduling the same identifier at a different time still creates a second future task, and they merge into one open task when they mature. The same commit made `processFutureTasks` emit `didUpdateTasks` after its loop (the merge rewrite in `111a64b` had lost it, so the UIs didn't refresh when a task matured), and log what it matures or merges.
- **Updating a task kept its old date** (`84cce89`, 2026-08-04). An upsert (`createTask` on an existing open identifier) and a future task merging into an open one only changed the title, so the widget and settings page kept showing the original age. Both now also set `date`.
- **NeDB returns `null`, not `undefined`** (`bf9d252`, 2026-08-04). `findOneAsync` resolves to `null` when nothing matches. The code compared with `== undefined` (which happened to work) but was typed as `Task | undefined`. It now compares strictly to `null`, and `getTask` normalises to `undefined`. The same commit replaced the `any` query types with `TaskQuery`, added `.catch` to every `trigger()` call (needed by `no-floating-promises`), awaited `createTask` in the API, and made `card.on('update')` handlers non-async.
- **Tasks without an identifier overwrote each other** (`111a64b`, 2026-08-04). After the NeDB migration, `createTask` ran `findOneAsync({ identifier: undefined, … })`, which matches any open task without an identifier, so a second anonymous task replaced the first one's title. The fix: only look for an existing task when `identifier !== undefined`. Keep this guard in every upsert path. The same commit made `processFutureTasks` merge into an existing open task instead of blindly flipping state, and made `on_update` pass the real `locked` value instead of `false`.

## 2.0.0 (2026-07-23 – 2026-08-04)

- **Lint config restored to athom's rules** (`ff8eaaa`, titled "fixed security issue"). The first flat eslint config had turned off `no-explicit-any` and dropped `no-floating-promises` / `no-misused-promises`. The rules were restored and linting was limited to `**/*.mts` with type information (`projectService`).
- The NeDB migration itself is described in [docs/history.md](docs/history.md).

## 1.3.x (2026-04 – 2026-07)

- **1.3.2: the locked/open conditions ignored `item`** (`e2551e1`). The conditions matched on identifier only, so `open_task_item` / `locked_task_item` answered for any item. They now apply the same `!item || task.item === item` filter as the actions. The locked condition throws `noMatchedTask` when nothing matches, rather than returning `false`.
- **minimatch vulnerability** (`c8c1ca3`, 2026-07-14). Pinned `minimatch ^9.0.7` under `@typescript-eslint/typescript-estree` with an `overrides` block. The override was removed again in the 2.0 dependency rewrite (`f7a9945`). If `npm audit` flags minimatch again, check this first.
- **Moved to Node 22** (`36b9878`). Moved from `@tsconfig/node16` to `node22`, added eslint, bumped TypeScript to 6, and updated the workflows to Node 22.

## 1.2.x (2025-12 – 2026-02)

- **1.2.2: the widget crashed with a tag error** (`417cb92`, earlier attempt `8d492a9`). Widgets added before the `tag` setting existed have `getSettings().tag === undefined`, so `tag['name']` threw. The fix guards `tag !== undefined` before reading `name`. Always treat widget settings as possibly missing.
- **Invalid `.homeychangelog.json`** (`4644fc8`, 2026-02-03). A trailing comma broke validation. The changelog is strict JSON.
- **Settings page form didn't clear after saving** (`7e59fa5`). `clear()` set `innerHTML` on `<input>` elements, which does nothing. It now sets `.value`.

## 1.1.x (2025-06 – 2025-09)

- **1.1.2: long titles ran under the checkmark in the widget** (`1d2ce61`). Added `padding-right: 35px` to the title paragraph.
- **1.1.1: the widget filtered on `-`** (`115edb0`). The "no filter" option `-` was sent as a tag, so nothing matched. It is now treated as no filter.

## 1.0.x (2025-02 – 2025-05)

- **1.0.6: cards failed when built in a standard (non-advanced) Flow** (`8079e98`). The compose JSON had empty `"args": []` / `"tokens": []` arrays, which broke card creation outside Advanced Flows. The fix removed those empty keys. Don't add empty `args`/`tokens` arrays to flow card JSON.
- **1.0.5: `on_create` crashed for tasks without an identifier** (`5cf209e`). The trigger was fired with `identifier: undefined`, and a string token can't be undefined. Missing identifiers then got a generated uuid. Since 2.0, every string token is sent as `value ?? ""` instead.
