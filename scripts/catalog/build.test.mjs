import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { run, loadCatalog } from './build.mjs'
import { pickDeltas } from './sources.mjs'

function gtin(body) {
  let s = 0
  for (let i = 0; i < body.length; i++) s += Number(body[body.length - 1 - i]) * (i % 2 === 0 ? 3 : 1)
  return body + ((10 - (s % 10)) % 10)
}
const C1 = gtin('789100010010')
const C2 = gtin('789200020020')
const C3 = gtin('789300030030')
const HEADER = ['code', 'product_name', 'generic_name', 'brands', 'categories_tags', 'quantity', 'countries_tags', 'last_modified_t'].join('\t')
const csv = (rows) => gzipSync(Buffer.from([HEADER, ...rows.map((r) => r.join('\t'))].join('\n')))
const delta = (objs) => gzipSync(Buffer.from(objs.map((o) => JSON.stringify(o)).join('\n')))

let dir, fx
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cat-'))
  fx = join(dir, 'fx')
  mkdirSync(fx)
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const writeFx = ({ off = [], obf = [], opf = [], deltas = {} }) => {
  writeFileSync(join(fx, 'obf.csv.gz'), csv(obf))
  writeFileSync(join(fx, 'opf.csv.gz'), csv(opf))
  writeFileSync(join(fx, 'off.csv.gz'), csv(off))
  writeFileSync(join(fx, 'delta-index.txt'), Object.keys(deltas).join('\n'))
  for (const [f, objs] of Object.entries(deltas)) writeFileSync(join(fx, f), delta(objs))
}
const silent = () => {}

describe('robô de catálogo (pipeline completo com fixtures)', () => {
  it('importação completa: valida, normaliza, deduplica e publica com manifesto íntegro', async () => {
    writeFx({
      off: [
        [C1, 'ARROZ BRANCO', '', 'Camil', 'en:cereals', '5 kg', 'en:brazil', '1700000000'],
        [C1, 'Arroz Branco Tipo 1', '', 'Camil', 'en:cereals', '5 kg', 'en:brazil', '1700100000'], // duplicado, mais novo
        [C2, 'Sabonete', '', 'Dove', 'en:soaps', '90 g', 'en:brazil', '1700000000'],
        ['123', 'Inválido', '', '', '', '', 'en:brazil', '1'], // GTIN inválido
        [gtin('544900000099'), 'Estrangeiro', '', '', '', '', 'en:france', '1'],
      ],
    })
    const r = await run({ dataDir: dir, mode: 'full', only: ['off'], fixtures: fx, log: silent })
    expect(r.published).toBe(true)
    const { manifest, map } = loadCatalog(join(dir, 'catalog'))
    expect(manifest.total).toBe(2)
    expect(map.get(C1)[0]).toBe('Arroz Branco Tipo 1')
    expect(map.get(C2)[2]).toBe('higiene')
    const status = JSON.parse(readFileSync(join(dir, 'catalog', 'status.json'), 'utf8'))
    expect(status.published).toBe(true)
    expect(readFileSync(join(dir, 'catalog', 'ATTRIBUTION.md'), 'utf8')).toMatch(/ODbL/)
  })

  it('atualização incremental por delta preserva o que já existe e atualiza o resto', async () => {
    writeFx({ off: [[C1, 'Arroz', '', 'Camil', '', '5 kg', 'en:brazil', '1700000000']] })
    await run({ dataDir: dir, mode: 'full', only: ['off'], fixtures: fx, log: silent })
    writeFx({
      deltas: {
        '1700000001.1700086400.json.gz': [
          { code: C1, product_name: 'Arroz Camil Tipo 1', brands: 'Camil', countries_tags: ['en:brazil'], last_modified_t: 1700080000, quantity: '5 kg' },
          { code: C3, product_name: 'Novo Produto', countries_tags: ['en:brazil'], last_modified_t: 1700080000 },
        ],
      },
    })
    const r = await run({ dataDir: dir, mode: 'delta', only: ['off'], fixtures: fx, log: silent })
    expect(r.published).toBe(true)
    const { map, manifest } = loadCatalog(join(dir, 'catalog'))
    expect(manifest.total).toBe(2)
    expect(map.get(C1)[0]).toBe('Arroz Camil Tipo 1')
    expect(map.has(C3)).toBe(true)
    const st = JSON.parse(readFileSync(join(dir, 'catalog', 'state.json'), 'utf8'))
    expect(st.lastDeltaTs).toBe(1700086400)
    // segunda execução não reprocessa o mesmo delta
    const again = await run({ dataDir: dir, mode: 'delta', only: ['off'], fixtures: fx, log: silent })
    expect(again.stats['off-delta'].files).toBe(0)
  })

  it('fonte indisponível: preserva o último catálogo válido e registra o erro', async () => {
    writeFx({ off: [[C1, 'Arroz', '', 'Camil', '', '5 kg', 'en:brazil', '1700000000']] })
    await run({ dataDir: dir, mode: 'full', only: ['off'], fixtures: fx, log: silent })
    const before = readFileSync(join(dir, 'catalog', 'manifest.json'), 'utf8')
    rmSync(join(fx, 'off.csv.gz')) // fonte some
    const r = await run({ dataDir: dir, mode: 'full', only: ['off'], fixtures: fx, log: silent })
    expect(r.published).toBe(false)
    expect(r.errors).toHaveLength(1)
    expect(readFileSync(join(dir, 'catalog', 'manifest.json'), 'utf8')).toBe(before)
    const status = JSON.parse(readFileSync(join(dir, 'catalog', 'status.json'), 'utf8'))
    expect(status.errors[0].source).toBe('off-full')
    expect(status.runs).toBe(2)
  })

  it('CSV corrompido/truncado nunca apaga o catálogo existente', async () => {
    writeFx({ off: [[C1, 'Arroz', '', 'Camil', '', '5 kg', 'en:brazil', '1700000000'], [C2, 'Sabonete', '', '', '', '', 'en:brazil', '1']] })
    await run({ dataDir: dir, mode: 'full', only: ['off'], fixtures: fx, log: silent })
    writeFileSync(join(fx, 'off.csv.gz'), Buffer.from('isto não é gzip'))
    const r = await run({ dataDir: dir, mode: 'full', only: ['off'], fixtures: fx, log: silent })
    expect(r.published).toBe(false)
    expect(loadCatalog(join(dir, 'catalog')).manifest.total).toBe(2)
  })

  it('fonte que devolve quase nada não substitui catálogo maior (guarda de tamanho)', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => [gtin('78910001' + String(1000 + i).padStart(4, '0')), `Produto ${i}`, '', '', '', '', 'en:brazil', '1'])
    writeFx({ off: rows })
    await run({ dataDir: dir, mode: 'full', only: ['off'], fixtures: fx, log: silent })
    expect(loadCatalog(join(dir, 'catalog')).manifest.total).toBe(30)
    // nova versão da fonte traz só 1 item: como o robô MESCLA, o total nunca cai
    writeFx({ off: [rows[0]] })
    const r = await run({ dataDir: dir, mode: 'full', only: ['off'], fixtures: fx, log: silent })
    expect(r.published).toBe(true)
    expect(loadCatalog(join(dir, 'catalog')).manifest.total).toBe(30)
  })

  it('uma das fontes com erro (OBF) não impede publicar as demais', async () => {
    writeFx({ off: [[C1, 'Arroz', '', '', '', '', 'en:brazil', '1']] })
    rmSync(join(fx, 'obf.csv.gz'))
    const r = await run({ dataDir: dir, mode: 'full', only: ['off', 'obf'], fixtures: fx, log: silent })
    expect(r.published).toBe(true)
    expect(r.errors.map((e) => e.source)).toEqual(['obf'])
  })

  it('não publica dados pessoais: shards só têm campos de produto', async () => {
    writeFx({ off: [[C1, 'Arroz', '', 'Camil', '', '5 kg', 'en:brazil', '1700000000']] })
    await run({ dataDir: dir, mode: 'full', only: ['off'], fixtures: fx, log: silent })
    const shardFile = join(dir, 'catalog', 's', `${C1.slice(0, 5)}.json`)
    expect(existsSync(shardFile)).toBe(true)
    const row = JSON.parse(readFileSync(shardFile, 'utf8')).items[C1]
    expect(row).toHaveLength(7) // nome, marca, categoria, tamanho, unidade, fonte, data
  })
})

describe('pickDeltas', () => {
  it('seleciona só os mais novos e em ordem', () => {
    const idx = '1.10.json.gz\n11.20.json.gz\nlixo.txt\n21.30.json.gz'
    expect(pickDeltas(idx, 10).map((x) => x.f)).toEqual(['11.20.json.gz', '21.30.json.gz'])
    expect(pickDeltas(idx, 30)).toEqual([])
    expect(pickDeltas(idx, 0, 2)).toHaveLength(2)
  })
})
