import type TasksApp from '../../app.mjs'
import type { Task } from '../../lib/storage.mjs'

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

  async completeTask({ homey, query }: RequestWithoutBody): Promise<void> {
    const dbQuery: any = { _id: query.id }
    const count = await (homey.app as TasksApp).store.completeTasks(dbQuery)
    if (count > 0) {
      homey.log(`Completed ${count} ${(count == 1) ? 'task' : 'tasks'} with identifier ${query.identifier} and item ${query.item}`)
    }
  },
}
