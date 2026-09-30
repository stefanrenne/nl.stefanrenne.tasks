import { readFileSync } from 'node:fs'
import { vi } from 'vitest'
import { Store } from '../../lib/storage.mjs'

type Args = Record<string, unknown>
type AutocompleteResult = { name: string, description?: string }
type AutocompleteListener = (query: string) => Promise<AutocompleteResult[]>

// The generated manifest, so the tests see the same flow cards as the runtime.
const manifest = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8'))

/** Records everything TasksApp and Store register on a flow card. */
export class FakeCard {
  id: string
  runListener?: (args: Args) => Promise<unknown>
  autocompleteListeners = new Map<string, AutocompleteListener>()
  updateListeners: (() => void)[] = []
  argumentValues: Args[] = []
  trigger = vi.fn(async (tokens: Args) => tokens)

  constructor(id: string) {
    this.id = id
  }

  registerRunListener(listener: (args: Args) => Promise<unknown>) {
    this.runListener = listener
    return this
  }

  registerArgumentAutocompleteListener(name: string, listener: AutocompleteListener) {
    this.autocompleteListeners.set(name, listener)
    return this
  }

  on(event: string, listener: () => void) {
    if (event === 'update') {
      this.updateListeners.push(listener)
    }
    return this
  }

  async getArgumentValues() {
    return this.argumentValues
  }

  async run(args: Args) {
    if (this.runListener === undefined) {
      throw new Error(`No run listener registered for ${this.id}`)
    }
    return this.runListener(args)
  }

  async autocomplete(arg: string, query: string) {
    const listener = this.autocompleteListeners.get(arg)
    if (listener === undefined) {
      throw new Error(`No ${arg} autocomplete registered for ${this.id}`)
    }
    return listener(query)
  }
}

export function createFakeHomey() {
  const cards = new Map<string, FakeCard>()
  const card = (id: string): FakeCard => {
    let result = cards.get(id)
    if (result === undefined) {
      result = new FakeCard(id)
      cards.set(id, result)
    }
    return result
  }
  const widgetAutocomplete = new Map<string, AutocompleteListener>()

  const homey = {
    manifest,
    app: undefined as unknown,
    flow: { getActionCard: card, getConditionCard: card, getTriggerCard: card },
    api: { realtime: vi.fn() },
    dashboards: {
      getWidget: () => ({
        registerSettingAutocompleteListener: (name: string, listener: AutocompleteListener) => widgetAutocomplete.set(name, listener),
      }),
    },
    // Return the key so tests can assert on it without depending on the English text.
    __: (key: string) => key,
    log: vi.fn(),
    error: vi.fn(),
    // The future task processor is driven by calling processFutureTasks directly.
    setTimeout: vi.fn(),
  }

  return { homey, card, cards, widgetAutocomplete }
}

export type FakeHomey = ReturnType<typeof createFakeHomey>['homey']

export function createMemoryStore(homey: FakeHomey): Store {
  return new Store(homey as unknown as ConstructorParameters<typeof Store>[0], { inMemoryOnly: true })
}
