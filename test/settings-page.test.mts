import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DOMWindow } from 'jsdom'
import { apiCalls, createPageHomey, loadPage, PageHomey } from './helpers/load-page.mjs'

const HTML_TITLE = '<img src=x onerror="window.injected=true">Buy milk'

const openTask = { _id: 'open-1', title: HTML_TITLE, date: new Date().toISOString(), identifier: '<b>id</b>', item: '<i>item</i>', tag: '<u>tag</u>', locked: false, state: 'open' }
const lockedTask = { _id: 'open-2', title: 'Locked', date: new Date().toISOString(), locked: true, state: 'open' }
const futureTask = { _id: 'future-1', title: 'Later', date: new Date(Date.now() + 3_600_000).toISOString(), locked: false, state: 'future' }

let homey: PageHomey
let window: DOMWindow

beforeEach(() => {
  homey = createPageHomey({
    'GET /tasks': () => [openTask, lockedTask, futureTask],
    'GET /identifiers': () => ['<b>evil</b>', 'plants'],
    'GET /tags': () => ['<i>label</i>'],
  })
  window = loadPage('settings/index.html', homey)
})

afterEach(() => {
  window.close()
})

const document = () => window.document
const rowOf = (title: string) => [...document().querySelectorAll('tr')].find((row) => row.querySelector('td.title')?.textContent === title)
const waitForRows = () => vi.waitFor(() => expect(rowOf('Locked')).toBeDefined())

describe('list', () => {
  it('shows task fields as text instead of interpreting them as HTML', async () => {
    await waitForRows()

    const row = rowOf(HTML_TITLE)
    expect(row).toBeDefined()
    const cells = [...row!.querySelectorAll('td')].map((cell) => cell.textContent)
    expect(cells).toEqual(expect.arrayContaining([HTML_TITLE, '<b>id</b>', '<i>item</i>', '<u>tag</u>']))
    expect(document().querySelector('#open-container img, #open-container b, #open-container i, #open-container u')).toBeNull()
    expect((window as unknown as { injected?: boolean }).injected).toBeUndefined()
  })

  it('puts open and future tasks in their own table', async () => {
    await waitForRows()
    expect(document().querySelector('#future-container td.title')?.textContent).toBe('Later')
    expect(apiCalls(homey)).toContain('GET /tasks?state%5B0%5D=open&state%5B1%5D=future')
  })

  it('titles the lock button after what clicking it does', async () => {
    await waitForRows()

    const lockedButton = rowOf('Locked')!.querySelector('a.lock') as HTMLElement
    const unlockedButton = rowOf(HTML_TITLE)!.querySelector('a.unlock') as HTMLElement
    expect(lockedButton.title).toBe('settings.list.actions.unlock')
    expect(unlockedButton.title).toBe('settings.list.actions.lock')

    lockedButton.click()
    unlockedButton.click()
    await vi.waitFor(() => expect(apiCalls(homey)).toEqual(expect.arrayContaining(['POST /unlock?id=open-2', 'POST /lock?id=open-1'])))
  })

  it('offers complete for open tasks and delete for future tasks', async () => {
    await waitForRows()
    expect(rowOf(HTML_TITLE)!.querySelector('a.checkmark')).not.toBeNull()
    expect(rowOf('Later')!.querySelector('a.trash')).not.toBeNull()
    expect(rowOf('Locked')!.querySelector('a.checkmark')).toBeNull()
  })

  it('uses translatable headings', () => {
    const headings = [...document().querySelectorAll('#page-list-tasks h2')].map((heading) => heading.getAttribute('data-i18n'))
    expect(headings).toEqual(['settings.list.open', 'settings.list.future'])
  })

  it('reloads on didUpdateTasks', async () => {
    await waitForRows()
    const before = apiCalls(homey).filter((call) => call.startsWith('GET /tasks')).length
    homey.emit('didUpdateTasks', {})
    await vi.waitFor(() => expect(apiCalls(homey).filter((call) => call.startsWith('GET /tasks')).length).toBe(before + 1))
  })
})

describe('create form', () => {
  const field = (id: string) => document().getElementById(id) as HTMLInputElement & HTMLSelectElement
  const setValue = (id: string, value: string, event: 'input' | 'change') => {
    field(id).value = value
    field(id).dispatchEvent(new window.Event(event))
  }
  const waitForOptions = () => vi.waitFor(() => {
    expect(field('identifier').options.length).toBeGreaterThan(1)
    expect(field('tag').options.length).toBeGreaterThan(1)
  })
  const sentTask = () => homey.api.mock.calls.find(([method, path]) => method === 'POST' && path === '/task')?.[2] as Record<string, unknown> | undefined

  it('shows identifiers and labels as text', async () => {
    await waitForOptions()
    expect([...field('identifier').options].map((option) => option.textContent)).toContain('<b>evil</b>')
    expect([...field('tag').options].map((option) => option.textContent)).toContain('<i>label</i>')
    expect(document().querySelector('#identifier b, #tag i')).toBeNull()
  })

  it.each(['', '   '])('saves no label when "create new label" is left as %j', async (typed) => {
    await waitForOptions()
    setValue('title', 'Water plants', 'input')
    setValue('tag', '', 'change')
    setValue('tag-create', typed, 'input')

    field('save').click()

    await vi.waitFor(() => expect(sentTask()).toBeDefined())
    expect(sentTask()).toMatchObject({ title: 'Water plants', identifier: undefined, item: undefined })
    expect(sentTask()?.tag).toBeUndefined()
  })

  it('saves a newly typed label', async () => {
    await waitForOptions()
    setValue('title', 'Water plants', 'input')
    setValue('tag', '', 'change')
    setValue('tag-create', ' garden ', 'input')

    field('save').click()

    await vi.waitFor(() => expect(sentTask()?.tag).toBe('garden'))
  })

  it('keeps save disabled until there is a title', async () => {
    await waitForOptions()
    field('save').click()
    setValue('title', '  ', 'input')
    field('save').click()
    expect(sentTask()).toBeUndefined()
  })
})
