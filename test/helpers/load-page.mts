import { readFileSync } from 'node:fs'
import { JSDOM, DOMWindow } from 'jsdom'
import { vi } from 'vitest'

type Route = (path: string, body: unknown) => unknown

/**
 * The `Homey` object the settings page and widget receive in onHomeyReady.
 * `api` answers from `routes`, keyed by "METHOD /path" (query string ignored) and records every call.
 */
export function createPageHomey(routes: Record<string, Route> = {}, settings: Record<string, unknown> = {}) {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>()
  return {
    api: vi.fn(async (method: string, path: string, body?: unknown) => {
      const route = routes[`${method} ${path.split('?')[0]}`]
      return route === undefined ? undefined : route(path, body)
    }),
    // Returns the key, so tests assert on keys rather than English text.
    __: (key: string) => key,
    on: (event: string, listener: (...args: unknown[]) => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener])
    },
    emit: (event: string, ...args: unknown[]) => listeners.get(event)?.forEach((listener) => listener(...args)),
    ready: vi.fn(),
    getSettings: () => settings,
    setHeight: vi.fn(),
    hapticFeedback: vi.fn(),
  }
}

export type PageHomey = ReturnType<typeof createPageHomey>

/**
 * Loads a static Homey page into jsdom, runs its inline scripts (external ones such as /homey.js and
 * Bootstrap are skipped) and calls onHomeyReady(homey), like the Homey webview does.
 * Close the returned window in afterEach to stop the page's setInterval.
 */
export function loadPage(file: string, homey: PageHomey): DOMWindow {
  const html = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true })
  const { window } = dom
  for (const script of window.document.querySelectorAll('script:not([src])')) {
    window.eval(script.textContent ?? '')
  }
  ;(window.eval('onHomeyReady') as (homey: PageHomey) => void)(homey)
  return window
}

/** Every `METHOD path` the page sent through Homey.api, in order. */
export const apiCalls = (homey: PageHomey) => homey.api.mock.calls.map(([method, path]) => `${method} ${path}`)
