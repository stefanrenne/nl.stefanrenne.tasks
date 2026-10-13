import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DOMWindow } from 'jsdom'
import { apiCalls, createPageHomey, loadPage, PageHomey } from './helpers/load-page.mjs'

const HTML_TITLE = '<img src=x onerror="window.injected=true">Buy milk'
const now = () => new Date().toISOString()

let homey: PageHomey
let window: DOMWindow

const load = (tasks: object[], settings: Record<string, unknown> = {}) => {
  homey = createPageHomey({ 'GET /tasks': () => tasks }, settings)
  window = loadPage('widgets/list-tasks/public/index.html', homey)
}

afterEach(() => {
  window?.close()
})

const items = () => [...window.document.querySelectorAll('li.task')]

describe('list-tasks widget', () => {
  it('shows titles and labels as text instead of interpreting them as HTML', async () => {
    load([{ _id: 'a', title: HTML_TITLE, date: now(), tag: '<b>home</b>', locked: false, state: 'open' }], { showTag: true })

    await vi.waitFor(() => expect(items()).toHaveLength(1))
    const [title, body] = [...items()[0].querySelectorAll('p')]
    expect(title.textContent).toBe(HTML_TITLE)
    expect(body.textContent).toMatch(/ \| <b>home<\/b>$/)
    expect(items()[0].querySelector('img, b')).toBeNull()
    expect((window as unknown as { injected?: boolean }).injected).toBeUndefined()
  })

  it('only shows the label when showTag is on', async () => {
    load([{ _id: 'a', title: 'A', date: now(), tag: 'home', locked: false, state: 'open' }], { showTag: false })
    await vi.waitFor(() => expect(items()).toHaveLength(1))
    expect(items()[0].querySelector('p.date')?.textContent).not.toContain('home')
  })

  it('requests open tasks, filtered by the tag setting unless it is "-"', async () => {
    load([], { tag: { name: 'home' } })
    await vi.waitFor(() => expect(apiCalls(homey)).toContain('GET /tasks?state=open&tag=home'))
    window.close()

    load([], { tag: { name: '-' } })
    await vi.waitFor(() => expect(apiCalls(homey)).toContain('GET /tasks?state=open'))
  })

  it('has no checkmark on locked tasks', async () => {
    load([
      { _id: 'a', title: 'Open', date: now(), locked: false, state: 'open' },
      { _id: 'b', title: 'Locked', date: now(), locked: true, state: 'open' },
    ])
    await vi.waitFor(() => expect(items()).toHaveLength(2))
    expect(items().map((item) => item.querySelector('.homey-custom-icon-checkmark') !== null)).toEqual([true, false])
  })

  it('completes a task by id when its checkmark is tapped', async () => {
    load([{ _id: 'a', title: 'Open', date: now(), locked: false, state: 'open' }])
    await vi.waitFor(() => expect(items()).toHaveLength(1))

    ;(items()[0].querySelector('.homey-custom-icon-checkmark') as HTMLElement).click()

    await vi.waitFor(() => expect(apiCalls(homey)).toContain('POST /complete?id=a'))
    expect(homey.hapticFeedback).toHaveBeenCalled()
  })

  it('shows the empty message when there are no open tasks', async () => {
    load([])
    await vi.waitFor(() => expect(window.document.getElementById('container')?.textContent).toBe('noOpenTasks'))
  })
})
