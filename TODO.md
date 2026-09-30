# TODO

Status: `[ ]` open · `[~]` in progress · `[?]` needs a decision

When an item is done, move it to [COMPLETED.md](COMPLETED.md) with its context (root cause, gotchas, how it was verified).

## Bugs

- [ ] **Task fields are rendered as HTML.** The settings page (`reload()`, identifier/label `<option>`s) and the widget (`task.title`) use `innerHTML` for values set from Flows. Switch to `textContent`. See [docs/settings-page.md](docs/settings-page.md).
- [ ] **Lock tooltips are swapped** on the settings page: the button that unlocks is titled "Lock task", and vice versa.
- [ ] **"Create new label" left empty** saves `tag: ""` instead of no tag (settings page).
- [ ] **Typo in flow card titles:** the `en` title of `create_task_item` and `complete_task_item` says "for iten".

## Cleanup

- [ ] **Undeclared `on_update` tokens.** `Store` triggers `on_update` with `locked` and `state`, which `on_update.json` doesn't declare. Either declare them (in all languages) or stop sending them.
- [ ] **Hardcoded English headings.** "Open tasks" / "Future tasks" on the settings page aren't translated.
- [?] **Add `.homeyignore`** so `CLAUDE.md`, `TODO.md`, `COMPLETED.md` and `docs/` aren't uploaded with the app.

## Features

- [?] **History tab** on the settings page. There is a placeholder `page-history` (`TODO`), its nav link is commented out, and its i18n key is wrong (`settings.tab-history` should be `settings.tab.history`). Completed tasks are already kept in the DB (soft state), so the data exists. Decide whether to build it or remove the placeholder.
