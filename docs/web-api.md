# Web API and UI

## App API (`api.mts`)

Routes are declared in `.homeycompose/app.json` under `api`. They are used by the settings page (`settings/index.html`). Single-task routes take the NeDB `_id` as the query parameter `id`.

| Handler | Method & path | Params | Notes |
|---|---|---|---|
| `getTasks` | `GET /tasks` | `state` (string, or `state[0]`, `state[1]`… for a list), `tag?` | **Public** (no auth). Sorted by date. |
| `createTask` | `POST /task` | body `{title, date, identifier?, item?, tag?}` | `date` is parsed with `new Date(...)`. A future date creates a `future` task. |
| `deleteTask` | `DELETE /task` | `id` | Removes the row and fires `on_complete`. |
| `completeTask` | `POST /complete` | `id` | |
| `lockTask` | `POST /lock` | `id` | |
| `unlockTask` | `POST /unlock` | `id` | |
| `getIdentifiers` | `GET /identifiers` | none | Rebuilds and returns `allIdentifiers`. |
| `getTags` | `GET /tags` | none | Rebuilds and returns `allTags`. |

`getTasks` filter semantics (both APIs): no `state` matches every state, **including `completed`**; a string matches exactly; an array (`state[0]=…&state[1]=…`) matches any of its values. `tag` is an exact match when given.

## Widget API (`widgets/list-tasks/api.mts`)

Routes are declared in `widgets/list-tasks/widget.compose.json`. This is a separate, narrower API:

| Handler | Method & path | Params |
|---|---|---|
| `getTasks` | `GET /tasks` | `state`, `tag?` (same filter logic as the app API) |
| `completeTask` | `POST /complete` | `id` |

The widget always requests `state=open`. For its settings and UI, see [widget.md](widget.md).

## Realtime

Every Store mutation emits `homey.api.realtime('didUpdateTasks', {})`. Both the settings page and the widget subscribe with `Homey.on('didUpdateTasks', …)` and reload their lists. New mutations must emit it too.

## Frontends

- `settings/index.html`: full management UI. See [settings-page.md](settings-page.md).
- `widgets/list-tasks/public/index.html`: the dashboard widget. See [widget.md](widget.md).

UI strings come from `locales/*.json` through `Homey.__()`.
