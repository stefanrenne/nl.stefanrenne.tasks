import DatastoreModule from '@seald-io/nedb'
import FlowCardTrigger from 'homey/lib/FlowCardTrigger.js'
import Homey from 'homey/lib/Homey.js'

// @seald-io/nedb ships a CommonJS runtime whose type declarations don't resolve
// to a constructable value under NodeNext ESM. The default import is the class at
// runtime, so re-type it as its constructor.
type Datastore<Schema> = import('@seald-io/nedb').default<Schema>
type DatastoreOptions = import('@seald-io/nedb').default.DataStoreOptions
const Datastore = DatastoreModule as unknown as {
    new <Schema>(pathOrOptions?: string | DatastoreOptions): Datastore<Schema>
}

export interface Task {
    _id?: string
    title: string
    date: Date
    identifier: string | undefined
    item: string | undefined
    tag: string | undefined
    locked: boolean
    state: 'open' | 'completed' | 'future'
}

/**
 * A NeDB query. Fields are matched loosely (operators, plain values) and the
 * optional `$where` predicate runs with `this` bound to the candidate Task.
 */
export type TaskQuery = {
    $where?: (this: Task) => boolean
    [field: string]: unknown
}

export class Store {
    
    private homey: Homey
    private db = new Datastore<Task>({ filename: '/userdata/tasks-v1.db', autoload: true })
    private taskOnCreate: FlowCardTrigger | undefined
    private taskOnUpdate: FlowCardTrigger | undefined
    private taskOnComplete: FlowCardTrigger | undefined

	constructor(homey: Homey) {
        this.homey = homey
        this.taskOnCreate = homey.flow.getTriggerCard('on_create')
        this.taskOnUpdate = homey.flow.getTriggerCard('on_update')
        this.taskOnComplete = homey.flow.getTriggerCard('on_complete')
    }

    async getTask(query: TaskQuery): Promise<Task | undefined> {
        // findOneAsync resolves to null (not undefined) when nothing matches;
        // normalise to undefined so callers can rely on a single "not found" value.
        const task: Task | null = await this.db.findOneAsync(query)
        return task ?? undefined
    }

    async getTasks(query: TaskQuery = {}): Promise<Task[]> {
        const tasks: Task[] = await this.db.findAsync(query).sort({ date: 1 })
        return tasks
    }

    async createTask(title: string, date: Date, identifier: string | undefined, item: string | undefined, tag: string | undefined = undefined) {
        if (date > new Date()) {
            date.setSeconds(0, 0)

            const updateQuery: TaskQuery = { state: 'future', date: date, identifier: identifier, $where: function () { return !item || this.item === item }}
            const oldFutureTask: Task | null = (identifier !== undefined) ? await this.db.findOneAsync(updateQuery) : null
            if (oldFutureTask === null) {
                await this.db.insertAsync({ title: title, date: date, identifier: identifier, item: item, tag: tag, locked: false, state: 'future' })
            } else {
                await this.db.updateAsync(updateQuery, { $set: { title: title } })
            }
            
            this.homey.api.realtime('didUpdateTasks', {})
            return
        }
    
        const updateQuery: TaskQuery = { state: 'open' , identifier: identifier, $where: function () { return !item || this.item === item }}
        const oldTask: Task | null = (identifier !== undefined) ? await this.db.findOneAsync(updateQuery) : null

        if (oldTask === null) {
            await this.db.insertAsync({ title: title, date: date, identifier: identifier, item: item, tag: tag, locked: false, state: 'open' })
            this.taskOnCreate?.trigger({ title: title, identifier: identifier ?? "", item: item ?? "" }).catch((error) => this.homey.error(error))
            this.homey.api.realtime('didUpdateTasks', {})
            return
        }

        if (oldTask.title === title) {
            // Existing task is not mutated
            return
        }

        await this.db.updateAsync(updateQuery, { $set: { title: title, date: date } })
        this.taskOnUpdate?.trigger({ oldTitle: oldTask.title, newTitle: title, identifier: identifier ?? "", item: item ?? "", locked: oldTask.locked, state: 'open' }).catch((error) => this.homey.error(error))
        this.homey.api.realtime('didUpdateTasks', {})
    }
    
    async completeTasks(query: TaskQuery): Promise<number> {
        const matches: Task[] = await this.db.findAsync(query)
        if (matches.length === 0) {
            return 0
        }

        matches.forEach((oldTask) => {
            this.taskOnComplete?.trigger({ title: oldTask.title, identifier: oldTask.identifier ?? "", item: oldTask.item ?? "", tag: oldTask.tag ?? "" }).catch((error) => this.homey.error(error))
        })
        await this.db.updateAsync(query, { $set: { state: 'completed' } }, { multi: true })
        this.homey.api.realtime('didUpdateTasks', {})
        return matches.length
    }

    async deleteTasks(query: TaskQuery): Promise<number> {
        const result = await this.db.removeAsync(query, { multi: true })
        if (result > 0) {
            this.homey.api.realtime('didUpdateTasks', {})
        }
        return result
    }
    
    async lockTasks(query: TaskQuery): Promise<number> {
        const result = await this.db.updateAsync(query, { $set: { locked: true } }, { multi: true })
        if (result.numAffected > 0) {
            this.homey.api.realtime('didUpdateTasks', {})
        }
        return result.numAffected
    }
    
    async unlockTasks(query: TaskQuery): Promise<number> {
        const result = await this.db.updateAsync(query, { $set: { locked: false } }, { multi: true })
        if (result.numAffected > 0) {
            this.homey.api.realtime('didUpdateTasks', {})
        }
        return result.numAffected
    }
    
    async tagTasks(tag: string | undefined = undefined, identifier: string, item: string | undefined = undefined): Promise<number> {
        const query: TaskQuery = { state: 'open', identifier: identifier, $where: function () { return !item || this.item === item } }
        const result = await this.db.updateAsync(query, { $set: { tag: tag } }, { multi: true })
        if (result.numAffected > 0) {
            this.homey.api.realtime('didUpdateTasks', {})
        }
        return result.numAffected
    }
    
    async processFutureTasks() {
        const startOfMinute = (date: Date | string) => {
            const result = new Date(date)
            result.setSeconds(0, 0)
            return result
        }
    
        const now = startOfMinute(new Date())
        const query: TaskQuery = { state: 'future', $where: function () { return startOfMinute(this.date) <= now }}
        const matured: Task[] = await this.db.findAsync(query)
        if (matured.length === 0) {
            return
        }

        this.homey.log(`Processing ${matured.length} matured future task${(matured.length == 1) ? '' : 's'}`)

        for (const maturedTask of matured) {
            const maturedQuery: TaskQuery = { _id: maturedTask._id }
            const openTaskQuery: TaskQuery = { state: 'open' , identifier: maturedTask.identifier, $where: function () { return !maturedTask.item || this.item === maturedTask.item }}
            const oldTask: Task | null = (maturedTask.identifier !== undefined) ? await this.db.findOneAsync(openTaskQuery) : null
            if (oldTask === null) {
                this.homey.log(`Maturing future task "${maturedTask.title}" to open state`)
                await this.db.updateAsync(maturedQuery, { $set: { state: 'open' } })
                this.taskOnCreate?.trigger({ title: maturedTask.title, identifier: maturedTask.identifier ?? "", item: maturedTask.item ?? "" }).catch((error) => this.homey.error(error))
            } else {
                this.homey.log(`Merging future task "${maturedTask.title}" into existing open task "${oldTask.title}"`)
                await this.db.updateAsync(openTaskQuery, { $set: { title: maturedTask.title, date: maturedTask.date } })
                await this.db.removeAsync(maturedQuery, { multi: true })
                this.taskOnUpdate?.trigger({ oldTitle: oldTask.title, newTitle: maturedTask.title, identifier: maturedTask.identifier ?? "", item: maturedTask.item ?? "", locked: oldTask.locked, state: 'open' }).catch((error) => this.homey.error(error))
            }
        }

        this.homey.api.realtime('didUpdateTasks', {})
    }
}