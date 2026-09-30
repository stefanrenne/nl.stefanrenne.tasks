import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = new URL('..', import.meta.url).pathname
const readJson = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8'))

const LANGUAGES = ['en', 'nl', 'de', 'no', 'sv']

type Translations = Record<string, string>
type FlowCard = {
  id: string
  title: Translations
  titleFormatted?: Translations
  hint?: Translations
  args?: { name: string, title?: Translations, placeholder?: Translations, values?: { id: string, title?: Translations, label?: Translations }[] }[]
  tokens?: { name: string, title: Translations }[]
}

const flowCardFiles = ['actions', 'conditions', 'triggers'].flatMap((type) =>
  readdirSync(join(root, '.homeycompose/flow', type))
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({ type, file, card: readJson(join('.homeycompose/flow', type, file)) as FlowCard })))

describe('flow card compose files', () => {
  it.each(flowCardFiles)('$type/$file is translated into every language', ({ card }) => {
    const missing: string[] = []
    const check = (translations: Translations | undefined, where: string) => {
      if (translations === undefined) return
      for (const language of LANGUAGES) {
        if (!translations[language]) missing.push(`${where}.${language}`)
      }
    }

    check(card.title, 'title')
    check(card.titleFormatted, 'titleFormatted')
    check(card.hint, 'hint')
    for (const arg of card.args ?? []) {
      check(arg.title, `${arg.name}.title`)
      check(arg.placeholder, `${arg.name}.placeholder`)
      for (const value of arg.values ?? []) {
        check(value.title ?? value.label, `${arg.name}.${value.id}`)
      }
    }
    for (const token of card.tokens ?? []) {
      check(token.title, `${token.name}.title`)
    }

    expect(missing).toEqual([])
  })

  it.each(flowCardFiles)('$type/$file has no empty args/tokens arrays (regression 1.0.6)', ({ card }) => {
    expect(card.args === undefined || card.args.length > 0).toBe(true)
    expect(card.tokens === undefined || card.tokens.length > 0).toBe(true)
  })

  it('app.json is regenerated from .homeycompose (same flow card ids)', () => {
    const manifest = readJson('app.json')
    for (const type of ['actions', 'conditions', 'triggers']) {
      const composed = flowCardFiles.filter((entry) => entry.type === type).map((entry) => entry.card.id).sort()
      const generated = (manifest.flow[type] as { id: string }[]).map((card) => card.id).sort()
      expect(generated, `flow.${type}`).toEqual(composed)
    }
  })
})

describe('locales', () => {
  const keys = (object: object, prefix = ''): string[] =>
    Object.entries(object).flatMap(([key, value]) =>
      typeof value === 'object' && value !== null ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`])

  const english = keys(readJson('locales/en.json')).sort()

  it.each(LANGUAGES.filter((language) => language !== 'en'))('locales/%s.json has the same keys as en.json', (language) => {
    expect(keys(readJson(`locales/${language}.json`)).sort()).toEqual(english)
  })

  it.each(LANGUAGES)('README.txt exists for %s', (language) => {
    const file = language === 'en' ? 'README.txt' : `README.${language}.txt`
    expect(readFileSync(join(root, file), 'utf8').trim()).not.toBe('')
  })
})

describe('release metadata', () => {
  const version = readJson('.homeycompose/app.json').version

  it('app.json and package.json match the .homeycompose version', () => {
    expect(readJson('app.json').version).toBe(version)
    expect(readJson('package.json').version).toBe(version)
  })

  it('.homeychangelog.json is valid JSON with an entry for the current version', () => {
    expect(readJson('.homeychangelog.json')[version]?.en).toBeTruthy()
  })
})
