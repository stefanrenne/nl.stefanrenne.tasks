# Dashboard widget

The `list-tasks` widget lists open tasks on a Homey dashboard.

| File | Role |
|---|---|
| `widgets/list-tasks/widget.compose.json` | Name, height (188, transparent), API routes, settings. |
| `widgets/list-tasks/api.mts` | Widget API: `getTasks`, `completeTask`. See [web-api.md](web-api.md). |
| `widgets/list-tasks/public/index.html` | The UI: static HTML and inline JS, styled with Homey widget CSS variables. |
| `widgets/list-tasks/public/checkmark.svg` | Complete icon, applied as a CSS mask. |
| `widgets/list-tasks/preview-{light,dark}.png` | Previews in the widget picker. |
| `app.mts` `registerWidgetListeners()` | Autocomplete for the `tag` setting. |

## Settings

| Id | Type | Default | Effect |
|---|---|---|---|
| `tag` | autocomplete | `-` | Filter by label. Suggestions come from `TasksApp.allTags`. An empty query adds a `-` option, which means no filter. The value is an object `{ name }`. |
| `showTag` | checkbox | `false` | Appends ` \| <label>` to each task's relative date. |

The `tag` setting can be `undefined` (a widget added before labels existed) or `{ name: '-' }`, so both must be treated as "no filter". Getting this wrong caused the 1.1.1 filter bug and the 1.2.2 crash. See [COMPLETED.md](../COMPLETED.md).

## Behaviour

- `reload()` calls `GET /tasks?state=open[&tag=…]` and renders a `<ul>` with the title, relative date and optional label, then calls `Homey.setHeight()` to fit the content.
- **Locked tasks have no checkmark**, so they can't be completed from the widget (that's the point of locking since 1.3.0).
- Tapping the checkmark gives haptic feedback and sends `POST /complete?id=<_id>`. The list is not changed locally: it re-renders on the `didUpdateTasks` realtime event.
- The empty state is done by **throwing** `Error(noOpenTasks)` inside `reload()`. The `.catch` renders `err.message`, so real API errors show up as text the same way.
- `updateTime()` re-renders the relative dates every second from `data-date` / `data-tag`.
- Title text has `padding-right: 35px` so long titles don't run under the checkmark (1.1.2 fix).

## Known issues

- `task.title` (and the date/label line) is written with `innerHTML`, so HTML in a title set from a Flow is rendered.
