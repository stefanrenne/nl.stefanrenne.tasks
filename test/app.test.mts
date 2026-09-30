import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeHomey, FakeHomey } from './helpers/fake-homey.mjs'

// TasksApp creates its Store with the on-device database path; swap in an in-memory one.
vi.mock('../lib/storage.mjs', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/storage.mjs')>()
  class MemoryStore extends original.Store {
    constructor(homey: ConstructorParameters<typeof original.Store>[0]) {
      super(homey, { inMemoryOnly: true })
    }
  }
  return { ...original, Store: MemoryStore }
})

const { default: TasksApp } = await import('../app.mjs')
const { default: appApi } = await import('../api.mjs')

const NOW = new Date('2026-01-15T10:00:30.500Z')

let homey: FakeHomey
let card: ReturnType<typeof createFakeHomey>['card']
let widgetAutocomplete: ReturnType<typeof createFakeHomey>['widgetAutocomplete']
let app: InstanceType<typeof TasksApp>

const id = (name: string) => ({ name })
const tasks = () => app.store.getTasks()
const openTasks = () => app.store.getTasks({ state: 'open' })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  const fake = createFakeHomey()
  homey = fake.homey
  card = fake.card
  widgetAutocomplete = fake.widgetAutocomplete
  app = new (TasksApp as unknown as new (homey: FakeHomey) => InstanceType<typeof TasksApp>)(homey)
  homey.app = app
  await app.onInit()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('onInit', () => {
  it('registers a run listener for every action and condition card in the manifest', () => {
    const ids = [...homey.manifest.flow.actions, ...homey.manifest.flow.conditions].map((flowCard: { id: string }) => flowCard.id)
    const missing = ids.filter((cardId: string) => card(cardId).runListener === undefined)
    expect(missing).toEqual([])
  })

  it('starts the future task processor', () => {
    expect(homey.setTimeout).toHaveBeenCalled()
  })
})

describe('create and schedule actions', () => {
  it('create_task creates an open task and returns the title token', async () => {
    expect(await card('create_task').run({ title: 'Dishes', identifier: id('dishes') })).toEqual({ title: 'Dishes' })
    expect(await openTasks()).toMatchObject([{ title: 'Dishes', identifier: 'dishes' }])
  })

  it('create_task works without an identifier', async () => {
    await card('create_task').run({ title: 'Anonymous' })
    expect((await tasks())[0].identifier).toBeUndefined()
  })

  it('create_task_item stores the item', async () => {
    await card('create_task_item').run({ title: 'Kitchen', identifier: id('plants'), item: 'kitchen' })
    expect((await tasks())[0]).toMatchObject({ identifier: 'plants', item: 'kitchen' })
  })

  it.each([
    ['minutes', 30, new Date('2026-01-15T10:30:00.000Z')],
    ['hours', 2, new Date('2026-01-15T12:00:00.000Z')],
    ['days', 3, new Date('2026-01-18T10:00:00.000Z')],
    ['weeks', 1, new Date('2026-01-22T10:00:00.000Z')],
    ['months', 1, new Date('2026-02-15T10:00:00.000Z')],
  ])('schedule_task schedules %s ahead, truncated to the minute', async (units, number, expected) => {
    await card('schedule_task').run({ title: 'Later', identifier: id('later'), number, units })
    const [task] = await tasks()
    expect(task.state).toBe('future')
    expect(task.date).toEqual(expected)
  })

  it('schedule_task rejects a non-numeric amount or unknown units', async () => {
    await expect(card('schedule_task').run({ title: 'x', number: 'abc', units: 'days' })).rejects.toThrow('Invalid schedule')
    await expect(card('schedule_task').run({ title: 'x', number: 1, units: 'years' })).rejects.toThrow('Invalid schedule')
    expect(await tasks()).toHaveLength(0)
  })
})

describe('complete actions', () => {
  beforeEach(async () => {
    await app.store.createTask('Kitchen', new Date(), 'plants', 'kitchen', 'home')
    await app.store.createTask('Balcony', new Date(), 'plants', 'balcony')
    await app.store.createTask('Dishes', new Date(), 'dishes', undefined, 'home')
  })

  it('complete_task_item completes only that item', async () => {
    await card('complete_task_item').run({ identifier: id('plants'), item: 'kitchen' })
    expect((await openTasks()).map((task) => task.title).sort()).toEqual(['Balcony', 'Dishes'])
  })

  it('complete_task completes every item of the identifier', async () => {
    await card('complete_task').run({ identifier: id('plants') })
    expect((await openTasks()).map((task) => task.title)).toEqual(['Dishes'])
  })

  it('complete_tag completes every open task with the tag', async () => {
    await card('complete_tag').run({ tag: id('home') })
    expect((await openTasks()).map((task) => task.title)).toEqual(['Balcony'])
  })

  it('complete_all completes every open task', async () => {
    await card('complete_all').run({})
    expect(await openTasks()).toHaveLength(0)
  })
})

describe('lock, tag and get actions', () => {
  beforeEach(async () => {
    await app.store.createTask('Kitchen', new Date(), 'plants', 'kitchen')
    await app.store.createTask('Balcony', new Date(), 'plants', 'balcony')
  })

  const itemState = async () => Object.fromEntries((await tasks()).map((task) => [task.item, task]))

  it('lock_task_item / unlock_task lock and unlock', async () => {
    await card('lock_task_item').run({ identifier: id('plants'), item: 'kitchen' })
    expect((await itemState()).kitchen.locked).toBe(true)
    expect((await itemState()).balcony.locked).toBe(false)

    await card('lock_task').run({ identifier: id('plants') })
    await card('unlock_task').run({ identifier: id('plants') })
    expect((await tasks()).some((task) => task.locked)).toBe(false)
  })

  it('tag_task_item / untag_task set and clear the tag', async () => {
    await card('tag_task_item').run({ tag: id('alice'), identifier: id('plants'), item: 'balcony' })
    expect((await itemState()).balcony.tag).toBe('alice')
    expect((await itemState()).kitchen.tag).toBeUndefined()

    await card('untag_task').run({ identifier: id('plants') })
    expect((await tasks()).every((task) => task.tag === undefined)).toBe(true)
  })

  it('get_all returns open tasks as json with a count', async () => {
    await app.store.createTask('Later', new Date(NOW.getTime() + 3_600_000), 'later', undefined)
    const result = await card('get_all').run({}) as { json: string, count: number }

    expect(result.count).toBe(2)
    const parsed = JSON.parse(result.json)
    expect(parsed.map((task: { title: string }) => task.title).sort()).toEqual(['Balcony', 'Kitchen'])
    expect(parsed[0]).toEqual({ title: expect.any(String), date: expect.any(String), locked: false, tag: '' })
  })
})

describe('conditions', () => {
  it('open_task / open_task_item report whether a matching open task exists', async () => {
    await app.store.createTask('Kitchen', new Date(), 'plants', 'kitchen')

    expect(await card('open_task').run({ identifier: id('plants') })).toBe(true)
    expect(await card('open_task').run({ identifier: id('dishes') })).toBe(false)
    expect(await card('open_task_item').run({ identifier: id('plants'), item: 'kitchen' })).toBe(true)
    expect(await card('open_task_item').run({ identifier: id('plants'), item: 'balcony' })).toBe(false)
  })

  it('locked_task / locked_task_item check the lock and respect the item (regression e2551e1)', async () => {
    await app.store.createTask('Kitchen', new Date(), 'plants', 'kitchen')
    await app.store.createTask('Balcony', new Date(), 'plants', 'balcony')
    await app.store.lockTasks({ item: 'kitchen' })

    expect(await card('locked_task').run({ identifier: id('plants') })).toBe(true)
    expect(await card('locked_task_item').run({ identifier: id('plants'), item: 'kitchen' })).toBe(true)
    expect(await card('locked_task_item').run({ identifier: id('plants'), item: 'balcony' })).toBe(false)
  })

  it('locked_task throws noMatchedTask when there is no open task', async () => {
    await expect(card('locked_task').run({ identifier: id('nothing') })).rejects.toBe('noMatchedTask')
  })
})

describe('autocomplete', () => {
  it('identifiers come from non-completed tasks, including future ones (regression 013191e)', async () => {
    await app.store.createTask('Open', new Date(), 'open-id', undefined)
    await app.store.createTask('Future', new Date(NOW.getTime() + 3_600_000), 'future-id', undefined)
    await app.store.createTask('Done', new Date(), 'done-id', undefined)
    await app.store.completeTasks({ identifier: 'done-id' })

    await app.updateAllIdentifiers()

    expect([...app.allIdentifiers].sort()).toEqual(['future-id', 'open-id'])
  })

  it('identifiers also come from the argument values of saved flow cards', async () => {
    card('complete_task').argumentValues = [{ identifier: id('from-flow') }]
    await app.updateAllIdentifiers()
    expect(app.allIdentifiers.has('from-flow')).toBe(true)
  })

  it('tags come from open tasks only', async () => {
    await app.store.createTask('Open', new Date(), 'a', undefined, 'open-tag')
    await app.store.createTask('Future', new Date(NOW.getTime() + 3_600_000), 'b', undefined, 'future-tag')
    await app.updateAllTags()
    expect([...app.allTags]).toEqual(['open-tag'])
  })

  it('only creating cards offer a "new identifier" entry', async () => {
    app.allIdentifiers = new Set(['plants', 'dishes'])

    expect(await card('create_task').autocomplete('identifier', 'pla')).toEqual([
      { name: 'pla', description: 'newIdentifier' },
      { name: 'plants', description: '' },
    ])
    expect(await card('create_task').autocomplete('identifier', 'plants')).toEqual([{ name: 'plants', description: '' }])
    expect(await card('complete_task').autocomplete('identifier', 'pla')).toEqual([{ name: 'plants', description: '' }])
    expect(await card('complete_task').autocomplete('identifier', '')).toEqual([
      { name: 'dishes', description: '' },
      { name: 'plants', description: '' },
    ])
  })

  it('tag_task offers a "new tag" entry, complete_tag does not', async () => {
    app.allTags = new Set(['home'])
    expect(await card('tag_task').autocomplete('tag', 'work')).toEqual([{ name: 'work', description: 'newTag' }])
    expect(await card('complete_tag').autocomplete('tag', 'work')).toEqual([])
  })

  it('the widget tag setting offers "-" for no filter on an empty query', async () => {
    app.allTags = new Set(['home'])
    const listener = widgetAutocomplete.get('tag')
    expect(await listener?.('')).toEqual([{ name: '-' }, { name: 'home' }])
    expect(await listener?.('ho')).toEqual([{ name: 'home' }])
  })

  it('the getIdentifiers / getTags api refresh and return the caches', async () => {
    await app.store.createTask('Open', new Date(), 'api-id', undefined, 'api-tag')
    const request = { homey, query: {}, params: {}, body: {} } as unknown as Parameters<typeof appApi.getIdentifiers>[0]
    expect(await appApi.getIdentifiers(request)).toEqual(['api-id'])
    expect(await appApi.getTags(request)).toEqual(['api-tag'])
  })
})

