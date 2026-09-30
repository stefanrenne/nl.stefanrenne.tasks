# Testing

Unit tests use [Vitest](https://vitest.dev) and live in `test/`. Run them with `npm test`, which first type-checks `test/` with `test/tsconfig.json` and then runs `vitest run`. CI (`homey-app-validate.yml`) runs `npm run lint` and `npm test` before the Homey validation.

## Setup

| File | Purpose |
|---|---|
| `vitest.config.mjs` | Aliases `homey` to `test/mocks/homey.mts` and includes `test/**/*.test.mts`. It's plain `.mjs` so neither `tsc` nor eslint picks it up. |
| `test/mocks/homey.mts` | Stand-in for the `homey` module, which only exists in the Homey runtime and isn't installed. It provides `Homey.App`, whose constructor stores `homey`. |
| `test/helpers/fake-homey.mts` | `createFakeHomey()` returns a fake `homey` built from the real generated `app.json` manifest. `FakeCard` records run, autocomplete and update listeners and has a `trigger` spy. It also provides `api.realtime`, `log`/`error` spies, `__` (returns the key), `setTimeout` (a no-op spy) and widget autocomplete capture. `createMemoryStore(homey)` returns a `Store` with an in-memory NeDB. |
| `test/tsconfig.json` | Extends the root config for type-checking only (`noEmit`, `rootDir: ".."`). The root `tsconfig.json` excludes `test/`, so tests are never compiled into `.homeybuild`. |
| `.homeyignore` | Keeps `test/` and `vitest.config.mjs` out of the uploaded app. |

`Store` takes an optional second constructor argument (NeDB options) for the in-memory database. `app.test.mts` uses `vi.mock('../lib/storage.mjs')` to make `TasksApp` construct its store that way.

## Test files

| File | Covers |
|---|---|
| `test/storage.test.mts` | `Store`: the create/upsert rules, future tasks, complete, delete, lock, tag, `processFutureTasks`, which triggers fire with which tokens, and when `didUpdateTasks` is emitted. |
| `test/api.test.mts` | Both Web APIs: the `getTasks` state/tag filter (for both APIs, via `describe.each`) and the id-based mutations. |
| `test/app.test.mts` | `TasksApp`: every action/condition card has a run listener, each card's behaviour, identifier/tag autocomplete, the widget tag setting, and `getIdentifiers`/`getTags`. |
| `test/manifest.test.mts` | Flow card compose files are translated into en/nl/de/no/sv and have no empty `args`/`tokens`. `app.json` has the same card ids as `.homeycompose`. Locale files have matching keys, and every README exists. Versions match across `.homeycompose/app.json`, `app.json` and `package.json`, and the changelog has an entry for the current version. |

## Conventions

- **Time:** use `vi.useFakeTimers({ toFake: ['Date'] })` and `vi.setSystemTime(...)`. Fake only `Date`, because NeDB needs real timers. Future dates are truncated to the minute.
- **Ordering:** tasks created in the same instant have no guaranteed order from `getTasks`. Key results by item or title, or sort them, instead of relying on array order.
- **Flow card args:** autocomplete args are passed as `{ name }` objects (`{ identifier: { name: 'plants' } }`), as Homey does.
- **Translations:** `homey.__` returns the key, so assert on keys like `'noMatchedTask'`, not English text.
- **Regressions:** name regression tests after the fixing commit, `(regression <hash>)`, and record the fix in `COMPLETED.md`.
