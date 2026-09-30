# Tasks

Tasks is a Homey to-do list app that creates and manages your tasks automatically. Manage the list from your Homey Flows, the app settings page, and a dashboard widget.

Example: a Flow creates a "Empty the dishwasher" task when the dishwasher finishes, and another Flow completes it when the dishwasher door opens. The task shows up on your dashboard until it's done.

## Features

- **Create tasks from Flows**, either right away or scheduled for later.
- **Identifiers** let later Flows find a task again to complete, update, lock or label it. Creating a task with an identifier that is already open replaces that task's title instead of adding a duplicate.
- **Items** narrow an identifier further. For example, the identifier `Water plants` with the items `Kitchen` and `Balcony` keeps one task per plant.
- **Labels** group tasks. You can complete all tasks with a label at once, or filter the widget by label.
- **Locking** marks a task as locked, and Flows can check that before acting on it.
- **Scheduled tasks** stay hidden until their time comes, then appear as open tasks.
- **Triggers** fire when a task is created, updated or completed, so other Flows can react.

## Flow cards

Most cards come in two versions: one that acts on every task with an identifier, and a "for item" version that only acts on the task for a specific item.

### Actions (Then)

| Card | What it does |
|---|---|
| Create task (for item) | Creates a task with a title and an optional identifier. If an open task with that identifier (and item) exists, its title is updated instead. |
| Schedule task (for item) | Creates a task that becomes open after a number of minutes, hours, days, weeks or months. |
| Complete task (for item) | Completes the open task(s) with that identifier (and item). |
| Complete all tasks marked with label | Completes every open task that has the label. |
| Complete all tasks | Completes every open task. |
| Lock / Unlock task (for item) | Marks the task(s) as locked or unlocked. |
| Mark task with label (for item) | Sets a label on the task(s). |
| Remove task mark (for item) | Removes the label. |
| Get all open tasks | Returns all open tasks as JSON (title, date, locked, label) plus a count, for use in later cards. |

### Conditions (And)

| Card | What it checks |
|---|---|
| Task is open / completed (for item) | Whether an open task with that identifier (and item) exists. |
| Task is locked / unlocked (for item) | Whether a matching open task is locked. Fails with "No open task found." if there is no match. |

### Triggers (When)

| Card | Tokens |
|---|---|
| A task is created | title, identifier, item |
| A task is updated | old title, new title, identifier, item |
| A task is completed | title, identifier, item, label, whether it was still a scheduled task |

A scheduled task fires **A task is created** when it becomes open. If an open task with the same identifier (and item) already exists at that moment, that task is updated instead and **A task is updated** fires. Deleting a task from the settings page also fires **A task is completed**.

## Settings page

Open the app's settings in the Homey app to:

- **List:** see open and scheduled tasks. Lock or unlock any task, complete open tasks, and delete scheduled tasks. A locked task has to be unlocked before you can complete or delete it.
- **Create:** add a task by hand, now or at a chosen date and time, with an optional identifier, item and label.

## Widget

The **List Tasks** dashboard widget shows your open tasks. Tap the checkmark to complete one. This works for all tasks, including those without an identifier.

Widget settings:
- **Filter by label:** only show tasks with this label (`-` shows all).
- **Show label:** show each task's label.

## Support
[Homey Community Forum](https://community.homey.app/t/app-pro-tasks/135410)
