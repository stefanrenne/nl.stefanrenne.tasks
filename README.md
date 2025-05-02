# Tasks

Tasks is a Homey to-do list app that allow you to automatically create and manages your tasks using a Homey Flows and/or the tasks widget.

Tasks can be created with an optional identifier from your Homey Flows.
In Homey Flows you can also complete tasks or update task texts when you have created a task with an identifier.
From the task widget you can view all open tasks and complete them task by task by pressing the checkmark icon. This also applies to tasks that don't have an identifier.

## Help support new languages
Please create a pr with a new translation for the following files:

- Translate `README.txt` into a `README.{language code}.txt`
- Translate `locales/en.json` into a `locales/{language code}.json`
- Translate all `en` keys into a `{language code}` key for the following flow cards:
	- `.homeycompose/flow/actions/complete_all.json`
	- `.homeycompose/flow/actions/create_task.json`
	- `.homeycompose/flow/actions/complete_task.json`
	- `.homeycompose/flow/conditions/open_task.json`
	- `.homeycompose/flow/triggers/on_complete.json`
	- `.homeycompose/flow/triggers/on_update.json`
	- `.homeycompose/flow/triggers/on_create.json`
- Translate the `name` + `description` key in `.homeycompose/app.json`
- Add your country flag + your name to the translators list in `.homeycompose/app.json`