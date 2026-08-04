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

    async getTask(query: any): Promise<Task | undefined> {
        const task: Task | undefined = await this.db.findOneAsync(query)
        return task
    }

    async getTasks(query: any = {}): Promise<Task[]> {
        const tasks: Task[] = await this.db.findAsync(query).sort({ date: 1 })
        return tasks
    }

    async createTask(title: string, date: Date, identifier: string | undefined, item: string | undefined, tag: string | undefined = undefined) {
        if (date > new Date()) {
            await this.db.insertAsync({ title: title, date: date, identifier: identifier, item: item, tag: tag, locked: false, state: 'future' })
            this.homey.api.realtime('didUpdateTasks', {})
            return
        }
    
        const updateQuery: any = { state: 'open' , identifier: identifier, $where: function () { return !item || this.item === item }}
        const oldTask: Task | undefined = (identifier !== undefined) ? await this.db.findOneAsync(updateQuery) : undefined
    
        if (oldTask == undefined) {
            await this.db.insertAsync({ title: title, date: date, identifier: identifier, item: item, tag: tag, locked: false, state: 'open' })
            this.taskOnCreate?.trigger({ title: title, identifier: identifier ?? "", item: item ?? "" })
            this.homey.api.realtime('didUpdateTasks', {})
            return
        }
    
        if (oldTask.title === title) {
            // Existing task is not mutated
            return
        }
    
        await this.db.updateAsync(updateQuery, { $set: { title: title } })
        this.taskOnUpdate?.trigger({ oldTitle: oldTask.title, newTitle: title, identifier: identifier ?? "", item: item ?? "", locked: oldTask.locked, state: 'open' })
        this.homey.api.realtime('didUpdateTasks', {})
    }
    
    async completeTasks(query: any): Promise<number> {
        const matches: Task[] = await this.db.findAsync(query)
        if (matches.length === 0) {
            return 0
        }
        
        matches.forEach((oldTask) => {
            this.taskOnComplete?.trigger({ title: oldTask.title, identifier: oldTask.identifier ?? "", item: oldTask.item ?? "", tag: oldTask.tag ?? "" })
        })
        await this.db.updateAsync(query, { $set: { state: 'completed' } }, { multi: true })
        this.homey.api.realtime('didUpdateTasks', {})
        return matches.length
    }

    async deleteTasks(query: any): Promise<number> {
        const result = await this.db.removeAsync(query, { multi: true })
        if (result > 0) {
            this.homey.api.realtime('didUpdateTasks', {})
        }
        return result
    }
    
    async lockTasks(query: any): Promise<number> {
        const result = await this.db.updateAsync(query, { $set: { locked: true } }, { multi: true })
        if (result.numAffected > 0) {
            this.homey.api.realtime('didUpdateTasks', {})
        }
        return result.numAffected
    }
    
    async unlockTasks(query: any): Promise<number> {
        const result = await this.db.updateAsync(query, { $set: { locked: false } }, { multi: true })
        if (result.numAffected > 0) {
            this.homey.api.realtime('didUpdateTasks', {})
        }
        return result.numAffected
    }
    
    async tagTasks(tag: string | undefined = undefined, identifier: string, item: string | undefined = undefined): Promise<number> {
        const query: any = { state: 'open', identifier: identifier, $where: function () { return !item || this.item === item } }
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
        const query: any = { state: 'future', $where: function () { return startOfMinute(this.date) <= now }}
        const matured: Task[] = await this.db.findAsync(query)
        if (matured.length === 0) {
            return
        }

        for (const maturedTask of matured) {
            const maturedQuery: any = { _id: maturedTask._id }
            const openTaskQuery: any = { state: 'open' , identifier: maturedTask.identifier, $where: function () { return !maturedTask.item || this.item === maturedTask.item }}
            const oldTask: Task | undefined = (maturedTask.identifier !== undefined) ? await this.db.findOneAsync(openTaskQuery) : undefined
            if (oldTask === undefined) {
                await this.db.updateAsync(maturedQuery, { $set: { state: 'open' } })
                this.taskOnCreate?.trigger({ title: maturedTask.title, identifier: maturedTask.identifier ?? "", item: maturedTask.item ?? "" })
            } else {
                await this.db.updateAsync(openTaskQuery, { $set: { title: maturedTask.title } })
                await this.db.removeAsync(maturedQuery, { multi: true })
                this.taskOnUpdate?.trigger({ oldTitle: oldTask.title, newTitle: maturedTask.title, identifier: maturedTask.identifier ?? "", item: maturedTask.item ?? "", locked: oldTask.locked, state: 'open' })
            }
        }
    }
}