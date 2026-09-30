# Settings page

`settings/index.html` is the app's settings page, opened from the Homey app. It is a single static HTML file with inline JS, no build step. It uses the bundled `bootstrap.min.css/js` for tabs and tables, Homey's `/homey.js` settings SDK, and SVG icons (`checkmark`, `trash`, `lock.closed`, `lock.open`) applied as CSS masks.

All data goes through the app Web API in `api.mts` (see [web-api.md](web-api.md)). Strings come from `locales/*.json` through `data-i18n` attributes and `Homey.__()`.

## Tabs

Tab switching is plain JS: each `.nav-link` has a `data-page` pointing to the id of a `.page` div, and the others get `.hidden`.

| Tab | Page id | Content |
|---|---|---|
| About | `page-about-tasks` | Static text from `settings.about.*`. |
| List | `page-list-tasks` | Two tables, "Open tasks" and "Future tasks". |
| Create | `page-create-task` | Form to add a task by hand. |
| *(History)* | `page-history` | Placeholder (`TODO`). Its nav link is commented out, and it uses the wrong i18n key `settings.tab-history` (the locale key is `settings.tab.history`). |

## List tab

`reload()` fetches `GET /tasks?state[0]=open&state[1]=future` and puts each task in the open or future table. Columns: title, date, identifier, item, label, actions. A missing value shows as `-`. An empty table shows `noOpenTasks` / `noFutureTasks`.

The date column shows relative time (`timeSince`: "5 minutes ago" for open tasks, "in 2 hours" for future ones, using the `time.untill.*` / `time.from.*` locale keys). `updateTime()` refreshes it every second from each cell's `data-date`.

The action buttons depend on the task's state:

| Task | Buttons | API call |
|---|---|---|
| Locked (open or future) | closed-lock icon → unlock | `POST /unlock?id=` |
| Unlocked, open | open-lock icon → lock, checkmark → complete | `POST /lock?id=`, `POST /complete?id=` |
| Unlocked, future | open-lock icon → lock, trash → delete | `POST /lock?id=`, `DELETE /task?id=` |

So a locked task can't be completed or deleted from this page until it is unlocked, open tasks can't be deleted, and future tasks can't be completed. Deleting fires `on_complete` with `future: true`.

The page doesn't reload itself after an action. It subscribes to the `didUpdateTasks` realtime event and calls `reload()` whenever the Store emits it.

## Create tab

| Field | Control | Sent as |
|---|---|---|
| Title | text (required) | `title` |
| Schedule | select: Now / In the future. "In the future" shows a `datetime-local` input with `min` set to now + 1 minute, prefilled with now + 1 hour. | `date` in epoch ms: now, or the chosen date |
| Identifier | select filled from `GET /identifiers`: `-` (none), the known identifiers, and "Create new identifier", which shows a text input | `identifier`, or `undefined` for `-` |
| Item identifier | text (optional) | `item`, or `undefined` when blank |
| Label | select filled from `GET /tags`: `-` (none), the known labels, and "Create new label", which shows a text input | `tag`, or `undefined` for `-` |

The Save button is disabled (`.is-disabled`) until the title is non-empty, a new identifier is non-empty when "Create new identifier" is chosen, and the date is not in the past. Validation only runs on input/change events. Save sends `POST /task`, then clears the form and reloads the identifier and label lists. A future date creates a `future` task, and all the identifier/item upsert rules in [data-model.md](data-model.md) apply.

## Known issues

- Task fields (title, identifier, item, label) are written with `innerHTML`, so HTML in a task title set from a Flow is rendered rather than escaped.
- The lock button's tooltip is reversed: a locked task's button (which unlocks) is titled "Lock task", and an unlocked task's button (which locks) is titled "Unlock task".
- The "Open tasks" and "Future tasks" headings are hardcoded English, not translated.
- Choosing "Create new label" and leaving the text input empty sends `tag: ""` instead of no tag.
