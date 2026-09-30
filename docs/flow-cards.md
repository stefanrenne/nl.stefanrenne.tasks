# Flow cards

Card definitions live in `.homeycompose/flow/{actions,conditions,triggers}/`. Listeners are registered in `app.mts` (`register*Listeners`). The id in the JSON is what the code uses, not the filename (`get_tasks.json` → `get_all`).

Most cards come in pairs: `xxx_task` (every task under an identifier) and `xxx_task_item` (adds a required `item` text arg that narrows the match). Both cards of a pair share one listener.

## Actions

| Id | Args | Behaviour |
|---|---|---|
| `create_task` / `_item` | `title`, `identifier?` (autocomplete, allows new) | `Store.createTask(title, now, …)`. Upserts on identifier(/item). See [data-model.md](data-model.md). |
| `schedule_task` / `_item` | `title`, `identifier?`, `number`, `units` (`minutes\|hours\|days\|weeks\|months`) | Creates a `future` task at now + offset, using calendar-aware date math (DST and month lengths). Throws on a non-numeric amount or an unknown unit. |
| `complete_task` / `_item` | `identifier` | Completes the matching open tasks. |
| `complete_tag` | `tag` | Completes all open tasks with that tag. |
| `complete_all` | none | Completes all open tasks. |
| `lock_task` / `_item` | `identifier` | Sets `locked: true` on matching open tasks. |
| `unlock_task` / `_item` | `identifier` | Sets `locked: false`. |
| `tag_task` / `_item` | `tag` (autocomplete, allows new), `identifier` | Sets the tag on matching open tasks. |
| `untag_task` / `_item` | `identifier` | Clears the tag. |
| `get_all` | none | Returns tokens `json` (an array of `{title, date, locked, tag}` for open tasks) and `count`. |

## Conditions

| Id | Args | Behaviour |
|---|---|---|
| `open_task` / `_item` | `identifier` | True if a matching open task exists. |
| `locked_task` / `_item` | `identifier` | True if any matching open task is locked. **Throws** `noMatchedTask` when there is no matching open task. |

## Triggers

| Id | Tokens | Fired by |
|---|---|---|
| `on_create` | `title`, `identifier`, `item` | A new open task, or a future task maturing without an open match. |
| `on_update` | `oldTitle`, `newTitle`, `identifier`, `item` | The title of an open task changed through an upsert, or a future task merged into it. |
| `on_complete` | `title`, `identifier`, `item`, `tag`, `future` | `completeTasks` **and** `deleteTasks`, once per task. |

Missing string values are sent as `""`.

## Autocomplete

- `identifier` args: suggestions come from `TasksApp.allIdentifiers`, which collects identifier values used in any card's saved args plus the identifiers of non-completed tasks. Cards that create tasks (`create_*`, `schedule_*`) offer a "Create new identifier" entry.
- `tag` args: suggestions come from `TasksApp.allTags`, which collects tags in saved card args plus the tags of open tasks. Only `tag_task*` offers "Create new label".
- Both caches are rebuilt whenever a card's args change (`card.on('update')`).

## Adding a card

1. Add `.homeycompose/flow/<type>/<id>.json` with every supported language (en, nl, de, no, sv). Leave out `args` / `tokens` when they're empty rather than writing `[]`: empty arrays broke cards in standard Flows (1.0.6).
2. Register its listener in `app.mts` and call it from `onInit`.
3. If it has an `identifier` or `tag` arg, register the matching autocomplete helper.
4. Update this document.
