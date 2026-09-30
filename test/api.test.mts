import { beforeEach, describe, expect, it } from 'vitest'
import appApi from '../api.mjs'
import widgetApi from '../widgets/list-tasks/api.mjs'
import { Store } from '../lib/storage.mjs'
import { createFakeHomey, createMemoryStore, FakeHomey } from './helpers/fake-homey.mjs'

type Request = Parameters<typeof appApi.getTasks>[0]

let homey: FakeHomey
let store: Store

beforeEach(async () => {
  homey = createFakeHomey().homey
  store = createMemoryStore(homey)
  homey.app = { store }

  const future = new Date(Date.now() + 3_600_000)
  await store.createTask('open-home', new Date(), 'a', undefined, 'home')
  await store.createTask('open-work', new Date(), 'b', undefined, 'work')
  await store.createTask('future-home', future, 'c', undefined, 'home')
  await store.createTask('done-home', new Date(), 'd', undefined, 'home')
  await store.completeTasks({ identifier: 'd' })
})

// Homey parses `state[0]=…&state[1]=…` into an array, so queries can hold arrays.
const request = (query: Record<string, string | string[]> = {}, body: Record<string, unknown> = {}) =>
  ({ homey, query, params: {}, body }) as unknown as Request

const titles = async (query: Record<string, string | string[]>, api: { getTasks: (request: Request) => Promise<{ title: string }[]> }) =>
  (await api.getTasks(request(query))).map((task) => task.title).sort()

describe.each([
  ['app api', appApi],
  ['widget api', widgetApi],
])('%s getTasks', (_name, api) => {
  it('returns every task, including completed ones, when no state is given (regression e09d305)', async () => {
    expect(await titles({}, api)).toEqual(['done-home', 'future-home', 'open-home', 'open-work'])
  })

  it('filters on a single state', async () => {
    expect(await titles({ state: 'open' }, api)).toEqual(['open-home', 'open-work'])
  })

  it('filters on a list of states', async () => {
    expect(await titles({ state: ['open', 'future'] }, api)).toEqual(['future-home', 'open-home', 'open-work'])
  })

  it('filters on tag, alone or combined with state', async () => {
    expect(await titles({ tag: 'home' }, api)).toEqual(['done-home', 'future-home', 'open-home'])
    expect(await titles({ state: 'open', tag: 'home' }, api)).toEqual(['open-home'])
  })
})

describe('app api mutations', () => {
  const idOf = async (title: string) => (await store.getTask({ title }))?._id as string

  it('createTask parses the epoch-ms date sent by the settings page', async () => {
    const future = new Date(Date.now() + 7_200_000)
    await appApi.createTask(request({}, { title: 'from settings', date: future.getTime(), identifier: 'x', tag: 'home' }))

    const task = await store.getTask({ title: 'from settings' })
    expect(task).toMatchObject({ state: 'future', identifier: 'x', tag: 'home' })
  })

  it('completeTask completes by id', async () => {
    await appApi.completeTask(request({ id: await idOf('open-home') }))
    expect((await store.getTask({ title: 'open-home' }))?.state).toBe('completed')
  })

  it('deleteTask removes by id', async () => {
    await appApi.deleteTask(request({ id: await idOf('future-home') }))
    expect(await store.getTask({ title: 'future-home' })).toBeUndefined()
  })

  it('lockTask and unlockTask toggle by id', async () => {
    const id = await idOf('open-work')
    await appApi.lockTask(request({ id }))
    expect((await store.getTask({ _id: id }))?.locked).toBe(true)
    await appApi.unlockTask(request({ id }))
    expect((await store.getTask({ _id: id }))?.locked).toBe(false)
  })

  it('widget completeTask completes by id', async () => {
    await widgetApi.completeTask(request({ id: await idOf('open-work') }))
    expect((await store.getTask({ title: 'open-work' }))?.state).toBe('completed')
  })
})
