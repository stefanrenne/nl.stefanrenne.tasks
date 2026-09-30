import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Store, Task } from '../lib/storage.mjs'
import { createFakeHomey, createMemoryStore, FakeCard, FakeHomey } from './helpers/fake-homey.mjs'

const NOW = new Date('2026-01-15T10:00:30.500Z')
const minutesFromNow = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000)

let homey: FakeHomey
let store: Store
let onCreate: FakeCard
let onUpdate: FakeCard
let onComplete: FakeCard

beforeEach(() => {
  // Only fake Date: NeDB relies on real timers/microtasks.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  const fake = createFakeHomey()
  homey = fake.homey
  store = createMemoryStore(homey)
  onCreate = fake.card('on_create')
  onUpdate = fake.card('on_update')
  onComplete = fake.card('on_complete')
})

afterEach(() => {
  vi.useRealTimers()
})

const all = () => store.getTasks()
const byState = (state: Task['state']) => store.getTasks({ state })
// Tasks created within the same instant have no guaranteed order, so compare them keyed by item.
const byItem = async () => Object.fromEntries((await all()).map((task) => [task.item, task]))

describe('createTask (now)', () => {
  it('inserts an open task, fires on_create and emits didUpdateTasks', async () => {
    await store.createTask('Water plants', new Date(), 'plants', undefined)

    const tasks = await all()
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ title: 'Water plants', identifier: 'plants', state: 'open', locked: false })
    expect(onCreate.trigger).toHaveBeenCalledWith({ title: 'Water plants', identifier: 'plants', item: '' })
    expect(homey.api.realtime).toHaveBeenCalledWith('didUpdateTasks', {})
  })

  it('sends empty strings for a missing identifier and item', async () => {
    await store.createTask('Anonymous', new Date(), undefined, undefined)
    expect(onCreate.trigger).toHaveBeenCalledWith({ title: 'Anonymous', identifier: '', item: '' })
  })

  it('does not merge tasks without an identifier (regression 111a64b)', async () => {
    await store.createTask('First', new Date(), undefined, undefined)
    await store.createTask('Second', new Date(), undefined, undefined)

    expect((await all()).map((task) => task.title).sort()).toEqual(['First', 'Second'])
    expect(onCreate.trigger).toHaveBeenCalledTimes(2)
    expect(onUpdate.trigger).not.toHaveBeenCalled()
  })

  it('updates the title and date of an open task with the same identifier (regression 84cce89)', async () => {
    await store.createTask('Old', new Date(), 'plants', undefined)
    vi.setSystemTime(minutesFromNow(5))
    const later = new Date()
    await store.createTask('New', later, 'plants', undefined)

    const tasks = await all()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('New')
    expect(tasks[0].date).toEqual(later)
    expect(onUpdate.trigger).toHaveBeenCalledWith(expect.objectContaining({ oldTitle: 'Old', newTitle: 'New', identifier: 'plants', item: '' }))
  })

  it('is a no-op when an open task with the same identifier already has the title', async () => {
    const first = new Date()
    await store.createTask('Same', first, 'plants', undefined)
    homey.api.realtime.mockClear()
    vi.setSystemTime(minutesFromNow(5))

    await store.createTask('Same', new Date(), 'plants', undefined)

    const tasks = await all()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].date).toEqual(first)
    expect(onUpdate.trigger).not.toHaveBeenCalled()
    expect(homey.api.realtime).not.toHaveBeenCalled()
  })

  it('keeps separate tasks per item under one identifier', async () => {
    await store.createTask('Kitchen', new Date(), 'plants', 'kitchen')
    await store.createTask('Balcony', new Date(), 'plants', 'balcony')
    await store.createTask('Kitchen again', new Date(), 'plants', 'kitchen')

    const tasks = await byItem()
    expect(Object.keys(tasks)).toHaveLength(2)
    expect(tasks.kitchen.title).toBe('Kitchen again')
    expect(tasks.balcony.title).toBe('Balcony')
  })

  it('matches any item when no item is given', async () => {
    await store.createTask('Kitchen', new Date(), 'plants', 'kitchen')
    await store.createTask('Any', new Date(), 'plants', undefined)

    const tasks = await all()
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ title: 'Any', item: 'kitchen' })
  })

  it('stores the tag', async () => {
    await store.createTask('Tagged', new Date(), undefined, undefined, 'alice')
    expect((await all())[0].tag).toBe('alice')
  })
})

describe('createTask (future)', () => {
  it('inserts a future task truncated to the minute without firing on_create', async () => {
    await store.createTask('Later', minutesFromNow(10), 'plants', undefined)

    const [task] = await all()
    expect(task.state).toBe('future')
    expect(task.date.getSeconds()).toBe(0)
    expect(task.date.getMilliseconds()).toBe(0)
    expect(onCreate.trigger).not.toHaveBeenCalled()
    expect(homey.api.realtime).toHaveBeenCalledWith('didUpdateTasks', {})
  })

  it('updates a future task with the same identifier and minute instead of duplicating it (regression e3dd926)', async () => {
    await store.createTask('First', minutesFromNow(10), 'plants', undefined)
    await store.createTask('Second', minutesFromNow(10), 'plants', undefined)

    const tasks = await byState('future')
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('Second')
  })

  it('keeps future tasks for different minutes apart', async () => {
    await store.createTask('Ten', minutesFromNow(10), 'plants', undefined)
    await store.createTask('Twenty', minutesFromNow(20), 'plants', undefined)
    expect(await byState('future')).toHaveLength(2)
  })

  it('never merges future tasks without an identifier', async () => {
    await store.createTask('A', minutesFromNow(10), undefined, undefined)
    await store.createTask('B', minutesFromNow(10), undefined, undefined)
    expect(await byState('future')).toHaveLength(2)
  })
})

describe('completeTasks', () => {
  it('soft-completes matches, fires on_complete per task and returns the count', async () => {
    await store.createTask('A', new Date(), 'a', undefined, 'home')
    await store.createTask('B', new Date(), 'b', undefined)

    const count = await store.completeTasks({ state: 'open' })

    expect(count).toBe(2)
    expect(await byState('completed')).toHaveLength(2)
    expect(onComplete.trigger).toHaveBeenCalledWith({ title: 'A', identifier: 'a', item: '', tag: 'home', future: false })
    expect(onComplete.trigger).toHaveBeenCalledWith({ title: 'B', identifier: 'b', item: '', tag: '', future: false })
  })

  it('returns 0 without emitting when nothing matches', async () => {
    homey.api.realtime.mockClear()
    expect(await store.completeTasks({ state: 'open' })).toBe(0)
    expect(homey.api.realtime).not.toHaveBeenCalled()
    expect(onComplete.trigger).not.toHaveBeenCalled()
  })
})

describe('deleteTasks', () => {
  it('removes the row and still fires on_complete, flagging future tasks (regression 2659f48)', async () => {
    await store.createTask('Later', minutesFromNow(10), 'plants', undefined)
    const [task] = await all()

    const count = await store.deleteTasks({ _id: task._id })

    expect(count).toBe(1)
    expect(await all()).toHaveLength(0)
    expect(onComplete.trigger).toHaveBeenCalledWith({ title: 'Later', identifier: 'plants', item: '', tag: '', future: true })
  })

  it('returns 0 when nothing matches', async () => {
    expect(await store.deleteTasks({ _id: 'missing' })).toBe(0)
  })
})

describe('lockTasks / unlockTasks / tagTasks', () => {
  beforeEach(async () => {
    await store.createTask('Kitchen', new Date(), 'plants', 'kitchen')
    await store.createTask('Balcony', new Date(), 'plants', 'balcony')
  })

  it('locks and unlocks matching tasks', async () => {
    expect(await store.lockTasks({ identifier: 'plants' })).toBe(2)
    expect((await all()).every((task) => task.locked)).toBe(true)

    expect(await store.unlockTasks({ item: 'kitchen' })).toBe(1)
    const tasks = await byItem()
    expect(tasks.kitchen.locked).toBe(false)
    expect(tasks.balcony.locked).toBe(true)
  })

  it('tags open tasks for an identifier, optionally narrowed by item', async () => {
    expect(await store.tagTasks('alice', 'plants', 'kitchen')).toBe(1)
    let tasks = await byItem()
    expect(tasks.kitchen.tag).toBe('alice')
    expect(tasks.balcony.tag).toBeUndefined()

    expect(await store.tagTasks('bob', 'plants')).toBe(2)
    tasks = await byItem()
    expect([tasks.kitchen.tag, tasks.balcony.tag]).toEqual(['bob', 'bob'])
  })

  it('clears the tag when tagging with undefined', async () => {
    await store.tagTasks('alice', 'plants')
    await store.tagTasks(undefined, 'plants')
    expect((await all()).every((task) => task.tag === undefined)).toBe(true)
  })

  it('only emits didUpdateTasks when something changed', async () => {
    homey.api.realtime.mockClear()
    expect(await store.lockTasks({ identifier: 'nothing' })).toBe(0)
    expect(await store.tagTasks('alice', 'nothing')).toBe(0)
    expect(homey.api.realtime).not.toHaveBeenCalled()
  })
})

describe('processFutureTasks', () => {
  it('leaves tasks that are not due yet', async () => {
    await store.createTask('Later', minutesFromNow(10), 'plants', undefined)
    await store.processFutureTasks()
    expect(await byState('future')).toHaveLength(1)
  })

  it('matures a due task to open and fires on_create', async () => {
    await store.createTask('Later', minutesFromNow(10), 'plants', undefined)
    vi.setSystemTime(minutesFromNow(10))
    homey.api.realtime.mockClear()

    await store.processFutureTasks()

    const tasks = await all()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].state).toBe('open')
    expect(onCreate.trigger).toHaveBeenCalledWith({ title: 'Later', identifier: 'plants', item: '' })
    expect(homey.api.realtime).toHaveBeenCalledWith('didUpdateTasks', {})
  })

  it('merges a due task into an existing open task with its title and date (regression 84cce89)', async () => {
    await store.createTask('Open', new Date(), 'plants', undefined)
    await store.lockTasks({ identifier: 'plants' })
    await store.createTask('Scheduled', minutesFromNow(10), 'plants', undefined)
    vi.setSystemTime(minutesFromNow(11))

    await store.processFutureTasks()

    const tasks = await all()
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ title: 'Scheduled', state: 'open', locked: true })
    // The future task's date, which was truncated to the minute when it was scheduled.
    expect(tasks[0].date).toEqual(new Date('2026-01-15T10:10:00.000Z'))
    expect(onUpdate.trigger).toHaveBeenCalledWith(expect.objectContaining({ oldTitle: 'Open', newTitle: 'Scheduled', locked: true }))
  })

  it('matures tasks without an identifier alongside other open ones', async () => {
    await store.createTask('Open', new Date(), undefined, undefined)
    await store.createTask('Scheduled', minutesFromNow(1), undefined, undefined)
    vi.setSystemTime(minutesFromNow(1))

    await store.processFutureTasks()

    expect((await byState('open')).map((task) => task.title)).toEqual(['Open', 'Scheduled'])
  })
})

describe('getTasks', () => {
  it('sorts by date ascending', async () => {
    await store.createTask('Second', minutesFromNow(20), 'b', undefined)
    await store.createTask('First', minutesFromNow(10), 'a', undefined)
    expect((await all()).map((task) => task.title)).toEqual(['First', 'Second'])
  })

  it('getTask returns undefined instead of null when nothing matches (regression bf9d252)', async () => {
    expect(await store.getTask({ _id: 'missing' })).toBeUndefined()
  })
})
