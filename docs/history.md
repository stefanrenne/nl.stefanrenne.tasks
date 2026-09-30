# Architecture history

Why the code looks the way it does. Details of individual fixes are in [COMPLETED.md](../COMPLETED.md).

## 1.x: settings-backed store (Feb 2025 – Apr 2026)

- CommonJS TypeScript (`app.ts`, `lib/storage.ts`, `api.js`) on `@tsconfig/node16`, and on Node 22 from April 2026.
- All tasks were a single array in `homey.settings` under the key **`tasks`**. Every change read the whole array, then filtered or mapped and rewrote it. There was no state field: completing a task **removed** it.
- Tasks without an identifier were given a random `uuid` identifier (the `uuid` dependency), so every task had one.
- Features were added one release at a time: labels and the widget filter (1.1.0), item ids (1.2.0), the settings page (1.2.1), locking (1.3.0) and the locked condition (1.3.1).
- Widget API routes were path-based: `GET /`, `GET /:tag`, `DELETE /:id`, `DELETE /:id/:item`.

## 2.0.0: NeDB and future tasks (July – Sept 2026)

Commit `f7a9945` rewrote the app:

- **TypeScript as ESM:** `.mts` files with `.mjs` import specifiers. The `nedb` default import had to be re-typed as a constructor (see the comment at the top of `lib/storage.mts`).
- **Storage moved to NeDB** (`@seald-io/nedb`) at `/userdata/tasks-v1.db`. Tasks get an `_id` and a `state` (`open`/`future`/`completed`). Completing is now a soft state change, and the `uuid` fallback identifier is gone (`identifier` can be `undefined`).
- **No migration, on purpose.** Tasks in the old `homey.settings` `tasks` array are not carried over to 2.0. This is a deliberate decision, not an open item: don't add an importer or flag it as a bug.
- **Future tasks** and the per-minute `processFutureTasks` timer were added. The `schedule_task*` cards came in `111a64b`.
- **Web API became id-based and query-based:** `GET /tasks?state=…&tag=…`, `POST /complete?id=`, and so on. The `future=true|false` query param was replaced by `state` (`498f31f`), and `GET /tasks` was made public at the same time.
- **Lint:** `eslint-config-athom` was replaced by a flat `eslint.config.mjs` using `typescript-eslint` with type information. It keeps athom's `no-floating-promises` / `no-misused-promises`, which is why every `trigger()` call ends in `.catch(...)`.

The fixes that landed after the 2.0.0 version bump (`bf9d252` through `2659f48`) have not been released under a new version number yet.
