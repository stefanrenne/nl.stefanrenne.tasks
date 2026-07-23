import type TasksApp from './app.mjs'
import type { Task } from './lib/storage.mjs'

type RequestWithBody = {
  homey: TasksApp['homey']
  query: Record<string, string>
  params: Record<string, string>
  body: Record<string, unknown>
}

type RequestWithoutBody = {
  homey: TasksApp['homey']
  query: Record<string, string>
  params: Record<string, string>
  body: Record<never, never>
}

export default {
  async getTasks({ homey, query }: RequestWithoutBody): Promise<Task[]> {
    const dbQuery: any = { $where: function () {
      const futureFilter = query.future === undefined || this.state === ((query.future === 'true') ? 'future' : 'open')
      const tagFilter = query.tag === undefined || this.tag === query.tag
      return futureFilter && tagFilter
    }}

    return (homey.app as TasksApp).store.getTasks(dbQuery)
  },

  async createTask({ homey, body }: RequestWithBody): Promise<void> {
    (homey.app as TasksApp).store.createTask(body.title as string, new Date(body.date as string), body.identifier as string, body.item as string, body.tag as string)
  },

  async completeTask({ homey, query }: RequestWithoutBody): Promise<void> {
    const dbQuery: any = { _id: query.id }
    const count = await (homey.app as TasksApp).store.completeTasks(dbQuery)
    if (count > 0) {
      homey.log(`Completed ${count} ${(count == 1) ? 'task' : 'tasks'} with id ${query.id}`)
    }
  },

  async deleteTask({ homey, query }: RequestWithoutBody): Promise<void> {
    const dbQuery: any = { _id: query.id }
    const count = await (homey.app as TasksApp).store.deleteTasks(dbQuery)
    if (count > 0) {
      homey.log(`Deleted ${count} ${(count == 1) ? 'task' : 'tasks'} with id ${query.id}`)
    }
  },

  async lockTask({ homey, query }: RequestWithoutBody): Promise<void> {
    const dbQuery: any = { _id: query.id }
    const count = await (homey.app as TasksApp).store.lockTasks(dbQuery)
    if (count > 0) {
      homey.log(`Locked ${count} ${(count == 1) ? 'task' : 'tasks'} with id ${query.id}`)
    }
  },

  async unlockTask({ homey, query }: RequestWithoutBody): Promise<void> {
    const dbQuery: any = { _id: query.id }
    const count = await (homey.app as TasksApp).store.unlockTasks(dbQuery)
    if (count > 0) {
      homey.log(`Unlocked ${count} ${(count == 1) ? 'task' : 'tasks'} with id ${query.id}`)
    }
  },

  async getIdentifiers({ homey }: RequestWithoutBody): Promise<string[]> {
    const app = homey.app as TasksApp
    await app.updateAllIdentifiers()
    return Array.from(app.allIdentifiers)
  },

  async getTags({ homey }: RequestWithoutBody): Promise<string[]> {
    const app = homey.app as TasksApp
    await app.updateAllTags()
    return Array.from(app.allTags)
  },
}
