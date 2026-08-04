import Homey from 'homey'
import { Task, Store } from './lib/storage.mjs'

export default class TasksApp extends Homey.App {

  allIdentifiers = new Set<string>()
  allTags = new Set<string>()

  store = new Store(this.homey)

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    await this.updateAllIdentifiers()
    await this.updateAllTags()
    this.registerTagTaskListeners()
    this.registerLockTaskListeners()
    this.registerUnlockTaskListeners()
    this.registerUntagTaskListener()
    this.registerOpenTaskListeners()
    this.registerLockedTaskListeners()
    this.registerCreateTaskListeners()
    this.registerScheduleTaskListeners()
    this.registerCompleteTaskListeners()
    this.registerCompleteMarkedTasksListeners()
    this.registerCompleteAllTasksListeners()
    this.registerGetAllTasksListeners()
    this.registerWidgetListeners()
    await this.startFutureTaskProcessor()
  }

  /**
   * Promotes future tasks to open tasks once their date has passed.
   * Runs on every whole minute homey.setTimeout disposes itself when the app unloads.
   */
  async startFutureTaskProcessor() {
    const scheduleNextRun = () => {
      const msUntilNextMinute = 60000 - (Date.now() % 60000)
      this.homey.setTimeout(async () => {
        await this.store.processFutureTasks()
        scheduleNextRun()
      }, msUntilNextMinute)
    }

    await this.store.processFutureTasks()
    scheduleNextRun()
  }

  async getAllCards(): Promise<(Homey.FlowCardAction | Homey.FlowCardTrigger | Homey.FlowCardCondition)[]> {
    const allCards: (Homey.FlowCardAction | Homey.FlowCardTrigger | Homey.FlowCardCondition)[] = []
    for (const flowTypeId in this.homey.manifest.flow) {
      if (Object.hasOwnProperty.call(this.homey.manifest.flow, flowTypeId)) {
				const flowType = this.homey.manifest.flow[flowTypeId]
				for (const flowcard of flowType) {
          if (flowcard.args && flowcard.args.some((flow: any) => flow.name == 'identifier')) {
            switch (flowTypeId) {
              case "actions":
                allCards.push(this.homey.flow.getActionCard(flowcard.id))
                break
              case "triggers":
                allCards.push(this.homey.flow.getTriggerCard(flowcard.id))
                break
              case "conditions":
                allCards.push(this.homey.flow.getConditionCard(flowcard.id))
                break
              default:
                break
            }
          }
        }
      }
    }
    return allCards
  }

  async updateAllIdentifiers() {
    const allCards = await this.getAllCards()
    const uniqueIdentifiers = await allCards.reduce(
      async (resultPromise, card) => {
        const result = await resultPromise
        const args = await card.getArgumentValues()
        args.filter(x => x.identifier).map(x => x.identifier.name).forEach(identifier => {
          result.add(identifier)
        })
        return result
    }, Promise.resolve(new Set<string>()))

    const query: any = { state: 'open', $where: function () { return this.identifier !== undefined }}
    const tasks: Task[] = await this.store.getTasks(query);
    (tasks.map((task) => task.identifier) as string[]).forEach(identifier => {
      uniqueIdentifiers.add(identifier)
    })
    this.allIdentifiers = uniqueIdentifiers
  }

  async updateAllTags() {
    const allCards = await this.getAllCards()

    const uniqueTags = await allCards.reduce(
      async (resultPromise, card) => {
        const result = await resultPromise
        const args = await card.getArgumentValues()
        args.filter(x => x.tag).map(x => x.tag.name).forEach(tag => {
          result.add(tag)
        })
        return result
    }, Promise.resolve(new Set<string>()))

    const query: any = { state: 'open', $where: function () { return this.tag !== undefined }}
    const tasks: Task[] = await this.store.getTasks(query);
    (tasks.map((task) => task.tag) as string[]).forEach(tag => {
      uniqueTags.add(tag)
    })
    this.allTags = uniqueTags
  }

  /** Helpers */
  registerIdentifierAutocompleteListenerForCard(card: Homey.FlowCardAction | Homey.FlowCardTrigger | Homey.FlowCardCondition, canRegisterNewIdentifier: boolean) {
    card.registerArgumentAutocompleteListener('identifier', async (query: string, args: any) => {
      const results = Array.from(this.allIdentifiers)
      .filter((result) => {
        return query.length == 0 || result.toLowerCase().includes(query.toLowerCase())
      })
      .sort()
      .map(identifier => {
        return {
          name: identifier,
          description: ''
        }
      })

      if (canRegisterNewIdentifier && query && query.length > 0 && !(results.length == 1 && results[0].name.toLowerCase() == query.toLowerCase())) {
        results.unshift({
          name: query,
          description: this.homey.__('newIdentifier')
        })
      }
      return results
    })

    card.on('update', async () => {
      await this.updateAllIdentifiers()
    })
  }

  registerTagAutocompleteListenerForCard(card: Homey.FlowCardAction | Homey.FlowCardTrigger | Homey.FlowCardCondition, canRegisterNewTag: boolean) {
    card.registerArgumentAutocompleteListener('tag', async (query: string, args: any) => {
      const results = Array.from(this.allTags)
      .filter((result) => {
        return query.length == 0 || result.toLowerCase().includes(query.toLowerCase())
      })
      .sort()
      .map(tag => {
        return {
          name: tag,
          description: ''
        }
      })

      if (canRegisterNewTag && query && query.length > 0 && !(results.length == 1 && results[0].name.toLowerCase() == query.toLowerCase())) {
        results.unshift({
          name: query,
          description: this.homey.__('newTag')
        })
      }
      return results
    })

    card.on('update', async () => {
      await this.updateAllTags()
    })
  }

  /** TaskListeners */
  registerOpenTaskListeners() {
    [
      this.homey.flow.getConditionCard('open_task'),
      this.homey.flow.getConditionCard('open_task_item')
    ].forEach(card => {
      this.registerIdentifierAutocompleteListenerForCard(card, false)
      card.registerRunListener(async (args) => {
        const identifier: string = args.identifier.name
        const item: string | undefined = (args.item) ? args.item : undefined
        const query: any = { state: 'open', identifier: identifier, $where: function () { return !item || this.item === item } }
        return await this.store.getTasks(query) !== undefined
      })
    })
  }

  registerLockedTaskListeners() {
    [
      this.homey.flow.getConditionCard('locked_task'),
      this.homey.flow.getConditionCard('locked_task_item')
    ].forEach(card => {
      this.registerIdentifierAutocompleteListenerForCard(card, false)
      card.registerRunListener(async (args) => {
        const identifier: string = args.identifier.name
        const item: string | undefined = (args.item) ? args.item : undefined
        const query: any = { state: 'open' , identifier: identifier, $where: function () { return !item || this.item === item }}
        const matches: Task[] = await this.store.getTasks(query)
        
        if (matches.length === 0) {
          throw this.homey.__('noMatchedTask')
        }
        return matches.some((element) => element.locked === true)
      })
    })
  }

  registerCreateTaskListeners() {
    [
      this.homey.flow.getActionCard('create_task'),
      this.homey.flow.getActionCard('create_task_item')
    ].forEach(card => {
      this.registerIdentifierAutocompleteListenerForCard(card, true)
      card.registerRunListener(async (args) => {
        const title: string = args.title
        const identifier: string | undefined = (args.identifier) ? args.identifier.name : undefined
        const item: string | undefined = (args.item) ? args.item : undefined
        await this.store.createTask(title, new Date(), identifier, item)
        return {
          title
        }
      })
    })
  }

  registerScheduleTaskListeners() {
    // Calendar-aware offset so days/weeks/months honour DST and month lengths.
    const scheduledDate = (amount: number, units: string): Date | undefined => {
      const date = new Date()
      switch (units) {
        case 'minutes': date.setMinutes(date.getMinutes() + amount); return date
        case 'hours': date.setHours(date.getHours() + amount); return date
        case 'days': date.setDate(date.getDate() + amount); return date
        case 'weeks': date.setDate(date.getDate() + amount * 7); return date
        case 'months': date.setMonth(date.getMonth() + amount); return date
        default: return undefined
      }
    };
    [
      this.homey.flow.getActionCard('schedule_task'),
      this.homey.flow.getActionCard('schedule_task_item')
    ].forEach(card => {
      this.registerIdentifierAutocompleteListenerForCard(card, true)
      card.registerRunListener(async (args) => {
        const title: string = args.title
        const identifier: string | undefined = (args.identifier) ? args.identifier.name : undefined
        const item: string | undefined = (args.item) ? args.item : undefined
        const amount: number = Number(args.number)
        const date = Number.isFinite(amount) ? scheduledDate(amount, args.units) : undefined
        if (date === undefined) {
          throw new Error(`Invalid schedule: ${args.number} ${args.units}`)
        }
        await this.store.createTask(title, date, identifier, item)
        return {
          title
        }
      })
    })
  }

  registerCompleteTaskListeners() {
    [
      this.homey.flow.getActionCard('complete_task'),
      this.homey.flow.getActionCard('complete_task_item')
    ].forEach(card => {
      this.registerIdentifierAutocompleteListenerForCard(card, false)
      card.registerRunListener(async (args) => {
        const identifier: string = args.identifier.name
        const item: string | undefined = (args.item) ? args.item : undefined
        const query: any = { state: 'open' , identifier: identifier, $where: function () { return !item || this.item === item }}
        const count = await this.store.completeTasks(query)
        if (count > 0) {
          this.homey.log(`Completed ${count} ${(count == 1) ? 'task' : 'tasks'} with identifier ${identifier} and item ${item}`)
        }
        return {}
      })
    })
  }

  registerCompleteMarkedTasksListeners() {
    [
      this.homey.flow.getActionCard('complete_tag')
    ].forEach(card => {
      this.registerTagAutocompleteListenerForCard(card, false)
      card.registerRunListener(async (args) => {
        const tag: string = args.tag.name
        const query: any = { state: 'open', tag: tag }
        const count = await this.store.completeTasks(query)
        if (count > 0) {
          this.homey.log(`Completed ${count} ${(count == 1) ? 'task' : 'tasks'} with tag ${tag}`)
        }
        return {}
      })
    })
  }

  registerCompleteAllTasksListeners() {
    [
      this.homey.flow.getActionCard('complete_all')
    ].forEach(card => {
      card.registerRunListener(async  (args) => {
        const query: any = { state: 'open' }
        const count = await this.store.completeTasks(query)
        if (count > 0) {
          this.homey.log(`Completed ${count} ${(count == 1) ? 'task' : 'tasks'}`)
        }
        return {}
      })
    })
  }

  registerGetAllTasksListeners() {
    const card = this.homey.flow.getActionCard('get_all')
    card.registerRunListener(async (args) => {
      const query: any = { state: 'open' }
      const tasks: Task[] = await this.store.getTasks(query)
      const data = tasks.map((element) => ({ title: element.title, date: element.date, locked: element.locked, tag: element.tag ?? '' }))
      const count = data.length
      const json = JSON.stringify(data)
      return {
        json,
        count
      }
    })
  }

  registerLockTaskListeners() {
    [
      this.homey.flow.getActionCard('lock_task'),
      this.homey.flow.getActionCard('lock_task_item')
    ].forEach(card => {
      this.registerIdentifierAutocompleteListenerForCard(card, false)
      card.registerRunListener(async (args) => {
        const item: string | undefined = (args.item) ? args.item : undefined
        const query: any = { state: 'open', identifier: args.identifier.name, $where: function () { return !item || this.item === item } }
        const count = await this.store.lockTasks(query)
        if (count > 0) {
          this.homey.log(`Locked ${count} ${(count == 1) ? 'task' : 'tasks'} with identifier ${args.identifier.name} and item ${item}`)
        }
        return {}
      })
    })
  }

  registerUnlockTaskListeners() {
    [
      this.homey.flow.getActionCard('unlock_task'),
      this.homey.flow.getActionCard('unlock_task_item')
    ].forEach(card => {
      this.registerIdentifierAutocompleteListenerForCard(card, false)
      card.registerRunListener(async (args) => {
        const item: string | undefined = (args.item) ? args.item : undefined
        const query: any = { state: 'open', identifier: args.identifier.name, $where: function () { return !item || this.item === item } }
        const count = await this.store.unlockTasks(query)
        if (count > 0) {
          this.homey.log(`Unlocked ${count} ${(count == 1) ? 'task' : 'tasks'} with identifier ${args.identifier.name} and item ${item}`)
        }
        return {}
      })
    })
  }

  registerTagTaskListeners() {
    [
      this.homey.flow.getActionCard('tag_task'),
      this.homey.flow.getActionCard('tag_task_item')
    ].forEach(card => {
      this.registerIdentifierAutocompleteListenerForCard(card, false)
      this.registerTagAutocompleteListenerForCard(card, true)
      card.registerRunListener(async (args) => {
        const item: string | undefined = (args.item) ? args.item : undefined
        const count = await this.store.tagTasks(args.tag.name, args.identifier.name, item)
        if (count > 0) {
          this.homey.log(`Tagged ${count} ${(count == 1) ? 'task' : 'tasks'}`)
        }
        return {}
      })
    })
  }

  registerUntagTaskListener() {
    [
      this.homey.flow.getActionCard('untag_task'),
      this.homey.flow.getActionCard('untag_task_item')
    ].forEach(card => {
    this.registerIdentifierAutocompleteListenerForCard(card, false)
      card.registerRunListener(async (args) => {
        const item: string | undefined = (args.item) ? args.item : undefined
        const count = await this.store.tagTasks(undefined, args.identifier.name, item)
        if (count > 0) {
          this.homey.log(`Untagged ${count} ${(count == 1) ? 'task' : 'tasks'}`)
        }
        return {}
      })
    })
  }

  registerWidgetListeners() {
    const widget = this.homey.dashboards.getWidget('list-tasks')
    
    widget.registerSettingAutocompleteListener('tag', async (query: string, settings: any) => {
      const results = Array.from(this.allTags)
      .filter((result) => {
        return query.length == 0 || result.toLowerCase().includes(query.toLowerCase())
      })
      .sort()
      .map(tag => {
        return {
          name: tag
        }
      })

      if (query.length === 0 ) {
        results.unshift({
          name: '-'
        })
      }
      return results
    })
  }
}
