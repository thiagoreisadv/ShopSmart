import { describe, it, expect } from 'vitest'
// @ts-expect-error módulo .mjs sem tipos
import * as lib from '../../scripts/catalog/lib.mjs'
import { normalizeBarcode, isValidGtin } from '@/lib/barcode'
import { guessCategory } from '@/domain/categories'
import { parseSize } from '@/lib/units'

describe('paridade robô × app', () => {
  const codes = ['7891000100103', '036000291452', '96385074', '7891000100104', 'abc', '12345678', '00012345678905']
  it('normalizeBarcode/isValidGtin coincidem', () => {
    for (const c of codes) {
      expect(lib.normalizeBarcode(c)).toBe(normalizeBarcode(c) && normalizeBarcode(c)!.length !== 8 ? normalizeBarcode(c) : normalizeBarcode(c))
      expect(lib.isValidGtin(c)).toBe(isValidGtin(c))
    }
  })
  it('guessCategory coincide', () => {
    for (const t of ['Arroz tipo 1', 'Leite integral', 'Cerveja pilsen', 'Sabonete', 'Fralda', 'Ração cães', 'Sorvete', 'xyz']) {
      expect(lib.guessCategory(t)).toBe(guessCategory(t))
    }
  })
  it('parseSize coincide (exceto cl, exclusivo do robô)', () => {
    for (const t of ['500 g', '1,5 L', '2kg', '350ml', '12 un', 'sem']) {
      expect(lib.parseSize(t)).toEqual(parseSize(t))
    }
  })
})

describe('normalização', () => {
  it('nomes: caixa alta vira título; espaços e controle removidos', () => {
    expect(lib.normalizeName('  ARROZ   TIPO 1\t CAMIL ')).toBe('Arroz Tipo 1 Camil')
    expect(lib.normalizeName('Leite Integral')).toBe('Leite Integral')
    expect(lib.normalizeName('')).toBe('')
    expect(lib.normalizeName('x'.repeat(300)).length).toBe(100)
  })
  it('marca: primeira da lista', () => {
    expect(lib.firstBrand('Nestlé, Outra,Mais')).toBe('Nestlé')
  })
})

describe('toRecord', () => {
  const base = { code: '7891000100103', product_name: 'LEITE CONDENSADO', brands: 'Moça,Nestlé', categories_tags: 'en:dairies', quantity: '395 g', countries_tags: 'en:brazil', last_modified_t: '1700000000' }
  it('aceita produto brasileiro válido', () => {
    const r = lib.toRecord(base, 'f')
    expect(r.code).toBe('7891000100103')
    expect(r.row).toEqual(['Leite Condensado', 'Moça', 'laticinios', 395, 'kg', 'f', '20231114'])
  })
  it('rejeita código inválido, sem nome e estrangeiro', () => {
    expect(lib.toRecord({ ...base, code: '7891000100104' }, 'f')).toBeNull()
    expect(lib.toRecord({ ...base, product_name: '' }, 'f')).toBeNull()
    expect(lib.toRecord({ ...base, code: '5449000000996', countries_tags: 'en:france' }, 'f')).toBeNull()
  })
  it('aceita pelo prefixo GS1 brasileiro mesmo sem tag de país', () => {
    expect(lib.toRecord({ ...base, countries_tags: '' }, 'f')).not.toBeNull()
  })
})

describe('mergeRows (duplicados)', () => {
  it('o mais recente vence e lacunas são preenchidas', () => {
    const old = ['Leite', 'Marca X', 'laticinios', 1000, 'l', 'f', '20230101']
    const neu = ['Leite Integral', '', 'geral', 0, '', 'b', '20240101']
    const m = lib.mergeRows(old, neu)
    expect(m[0]).toBe('Leite Integral')
    expect(m[1]).toBe('Marca X')
    expect(m[2]).toBe('laticinios')
    expect(m[3]).toBe(1000)
    expect(m[6]).toBe('20240101')
  })
})

describe('shards, manifesto e validação', () => {
  const mk = (n: number) => {
    const m = new Map<string, unknown[]>()
    for (let i = 0; i < n; i++) {
      const body = '78910' + String((i * 7919) % 10000000).padStart(7, '0')
      const gt = body + String((10 - (body.split('').reverse().reduce((s, d, k) => s + Number(d) * (k % 2 === 0 ? 3 : 1), 0) % 10)) % 10)
      m.set(gt, [`Produto ${i}`, 'M', 'geral', 0, '', 'f', '20240101'])
    }
    return m
  }
  it('divide shard grande em prefixo maior e mantém tudo localizável', () => {
    const recs = mk(400)
    const shards = lib.buildShards(recs, 5000)
    expect(shards.size).toBeGreaterThan(1)
    for (const [prefix, text] of shards) {
      for (const code of Object.keys(JSON.parse(text).items)) expect(code.startsWith(prefix)).toBe(true)
    }
    const total = [...shards.values()].reduce((s, t) => s + Object.keys(JSON.parse(t).items).length, 0)
    expect(total).toBe(400)
  })
  it('valida catálogo íntegro e detecta adulteração', () => {
    const shards = lib.buildShards(mk(50))
    const manifest = lib.buildManifest(shards, { version: 'v', generatedAt: 'x', sources: lib.SOURCES })
    expect(lib.validateCatalog(manifest, (p: string) => shards.get(p) ?? null)).toEqual([])
    const bad = lib.validateCatalog(manifest, (p: string) => (shards.get(p) ?? '') + ' ')
    expect(bad.join()).toMatch(/hash divergente/)
  })
  it('recusa queda suspeita de tamanho (fonte truncada)', () => {
    const shards = lib.buildShards(mk(10))
    const manifest = lib.buildManifest(shards, { version: 'v', generatedAt: 'x', sources: lib.SOURCES })
    expect(lib.validateCatalog(manifest, (p: string) => shards.get(p) ?? null, 100).join()).toMatch(/queda suspeita/)
  })
})
