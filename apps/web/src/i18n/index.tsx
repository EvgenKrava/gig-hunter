import { Fragment, useSyncExternalStore, type ReactNode } from 'react'
import { en, type Key } from './en'
import { uk } from './uk'
import { ru } from './ru'

// One language choice for every Only Tools app: the `ot_lang` cookie on .onlytools.click (set by the
// landing, CarLog, the admin and here), else the browser language, else English.
export type Lang = 'en' | 'uk' | 'ru'
export const LANGS: { code: Lang; label: string; name: string }[] = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'uk', label: 'UA', name: 'Українська' },
  { code: 'ru', label: 'RU', name: 'Русский' },
]
const DICT: Record<Lang, Record<Key, string>> = { en, uk, ru }
export const LOCALE: Record<Lang, string> = { en: 'en-US', uk: 'uk-UA', ru: 'ru-RU' }

const pick = (v: string | null | undefined): Lang | null => {
  const c = String(v ?? '').toLowerCase().slice(0, 2)
  return c === 'en' || c === 'uk' || c === 'ru' ? c : null
}
function detect(): Lang {
  if (typeof document === 'undefined') return 'en'
  const m = document.cookie.match(/(?:^|;\s*)ot_lang=([^;]+)/)
  return pick(m?.[1]) ?? (navigator.languages ?? [navigator.language]).map(pick).find((x): x is Lang => !!x) ?? 'en'
}

let current: Lang = detect()
const listeners = new Set<() => void>()
if (typeof document !== 'undefined') document.documentElement.lang = current

export const getLang = () => current
export function setLang(code: Lang) {
  current = code
  const domain = location.hostname.endsWith('onlytools.click') ? '; domain=onlytools.click' : ''
  document.cookie = `ot_lang=${code}; path=/; max-age=31536000; samesite=lax${domain}`
  document.documentElement.lang = code
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

type Vars = Record<string, string | number>
/** Translates in the current language. Usable outside components (it does not re-render by itself). */
export function t(key: Key, vars?: Vars): string {
  return DICT[current][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? `{${name}}`))
}

/** Like t(), but `{name}` can be a React node (a link, bold text). */
export function tRich(key: Key, nodes: Record<string, ReactNode>): ReactNode {
  return DICT[current][key].split(/(\{\w+\})/).map((part, i) => {
    const m = part.match(/^\{(\w+)\}$/)
    return <Fragment key={i}>{m && m[1]! in nodes ? nodes[m[1]!] : part}</Fragment>
  })
}

/** Re-renders the component when the language changes. */
export function useT() {
  const lang = useSyncExternalStore(subscribe, getLang, getLang)
  return { t, tRich, lang, locale: LOCALE[lang] }
}

export function LanguageSwitch() {
  const { lang } = useT()
  return (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label={t('menu.language')}>
      {LANGS.map((l) => (
        <button key={l.code} type="button" lang={l.code} title={l.name} aria-pressed={lang === l.code} onClick={() => setLang(l.code)}
          className={`min-h-9 flex-1 rounded-md text-sm font-medium ${lang === l.code ? 'bg-white text-brand shadow-sm dark:bg-slate-900' : 'text-slate-600 dark:text-slate-300'}`}>
          {l.label}
        </button>
      ))}
    </div>
  )
}
