import { afterEach, describe, expect, it } from 'vitest'
import { getLang, setLang, t } from '.'
import { en } from './en'
import { uk } from './uk'
import { ru } from './ru'

describe('i18n', () => {
  afterEach(() => setLang('en'))

  it('has every English key in Ukrainian and Russian', () => {
    expect(Object.keys(uk).sort()).toEqual(Object.keys(en).sort())
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort())
  })

  it('switches language, fills values and stores the shared cookie', () => {
    setLang('uk')
    expect(getLang()).toBe('uk')
    expect(t('time.m', { n: 5 })).toBe('5 хв тому')
    expect(document.cookie).toContain('ot_lang=uk')
    setLang('ru')
    expect(t('nav.jobs')).toBe('Заказы')
  })
})
