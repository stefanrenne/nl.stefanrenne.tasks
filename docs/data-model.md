# Data model

All task data goes through `Store` in `lib/storage.mts`, which wraps a NeDB datastore at `/userdata/tasks-v1.db` (autoloaded, persisted in Homey's app userdata).

## Task

| Field | Type | Notes |
|---|---|---|
| `_id` | `string` | Assigned by NeDB. Used by the Web API to target a single task. |
| `title` | `string` | Display text. |
| `date` | `Date` | Creation time for open tasks, due time for future tasks (seconds zeroed). |
| `identifier` | `string \| undefined` | Optional key set from Flows. Enables updating, completing, locking and tagging from Flows. |
| `item` | `string \| undefined` | Optional sub-key under an identifier (the `*_item` flow cards). |
| `tag` | `string \| undefined` | Label shown in the UI and used for `complete_tag` and widget filtering. |
| `locked` | `boolean` | Informational flag set by the lock/unlock cards and the settings page. |
| `state` | `'open' \| 'future' \| 'completed'` | See the lifecycle below. |

## Lifecycle

```
createTask(date > now) ──► future ──(processFutureTasks, every minute)──► open ──► completed
createTask(date ≤ now) ─────────────────────────────────────────────────► open
                                                           deleteTasks ──► (row removed)
```

- **Completing is a soft state change.** Completed rows stay in the database. `deleteTasks` removes rows, but it still fires `on_complete`.
- **Future tasks** are created by `schedule_task*` or by the settings page with a future date. `App.startFutureTaskProcessor` runs `processFutureTasks` on every whole minute.

## Identifier / item upsert rules

Matching uses `{ identifier, $where: !item || this.item === item }`, so when no `item` is given, **every item under the identifier matches**.

`createTask` with an `identifier`:

| Case | Result | Trigger |
|---|---|---|
| Future date, a future task with the same identifier(/item) **and the same minute** exists | Title updated in place | none |
| Future date, otherwise | New `future` row | none |
| Now, an open task matches, same title | No-op | none |
| Now, an open task matches, different title | Title and date updated | `on_update` |
| Now, no open match | New `open` row | `on_create` |

Tasks without an identifier are always inserted. This relies on the `identifier !== undefined` guard before `findOneAsync`: NeDB's `{ identifier: undefined }` matches every task without an identifier, so without the guard anonymous tasks overwrite each other (fixed in `111a64b`). Keep the guard in every upsert path.

NeDB's `findOneAsync` resolves to `null`, not `undefined`, when nothing matches.

When a future task matures:
- If no open task matches its identifier(/item), it becomes `open` and fires `on_create`.
- If an open task already matches, that open task takes the new title and date, the future row is deleted, and `on_update` fires.

## Side effects per Store method

| Method | Flow triggers | Realtime `didUpdateTasks` |
|---|---|---|
| `createTask` | `on_create` or `on_update` (see above) | yes, except on the unchanged-title no-op |
| `completeTasks` | `on_complete` per matched task | yes, if anything matched |
| `deleteTasks` | `on_complete` per matched task | yes, if anything matched |
| `lockTasks` / `unlockTasks` / `tagTasks` | none | yes, if any rows changed |
| `processFutureTasks` | `on_create` / `on_update` per matured task | yes, if anything matured |

`on_update` is triggered with extra `locked` and `state` values that are not declared as tokens in `on_update.json`.

## Querying

`TaskQuery` is a NeDB query object. `$where` must be a `function` expression (not an arrow function) because NeDB binds `this` to the candidate task. `getTasks` always sorts by `date` ascending.
