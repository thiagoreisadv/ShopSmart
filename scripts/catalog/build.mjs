#!/usr/bin/env node
// Robô de atualização do catálogo ShopSmart.
//   node scripts/catalog/build.mjs --data <dir> [--mode delta|full] [--only off,obf,opf] [--fixtures <dir>]
// Regras de ouro:
//  * nunca apaga nem sobrescreve um catálogo válido com um resultado ruim (validação + troca atômica);
//  * fonte fora do ar => mantém o último catálogo e registra o erro em status.json;
//  * só dados públicos de produtos; nada de dados pessoais ou preços privados.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync, createReadStream } from 'node:fs'
import { join, resolve } from 'node:path'
import { buildManifest, buildShards, mergeRows, SOURCES, validateCatalog } from './lib.mjs'
import { URLS, httpStream, httpText, pickDeltas, readCsv, readDelta } from './sources.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']] : acc), []),
)

export function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

/** Carrega o catálogo atual (shards + manifesto) em um Map<code,row>. */
export function loadCatalog(dir) {
  const manifest = readJson(join(dir, 'manifest.json'), null)
  const map = new Map()
  if (!manifest) return { manifest: null, map }
  for (const prefix of Object.keys(manifest.shards)) {
    const shard = readJson(join(dir, 's', `${prefix}.json`), null)
    if (!shard) continue
    for (const [code, row] of Object.entries(shard.items)) map.set(code, row)
  }
  return { manifest, map }
}

export async function run({ dataDir, mode = 'delta', only = ['off', 'obf', 'opf'], fetchImpl = fetch, now = new Date(), log = console.log, fixtures = null }) {
  const catalogDir = join(dataDir, 'catalog')
  mkdirSync(catalogDir, { recursive: true })
  const statusPath = join(catalogDir, 'status.json')
  const prevStatus = readJson(statusPath, { runs: 0, errors: [] })
  const state = readJson(join(catalogDir, 'state.json'), { lastDeltaTs: 0 })
  const { manifest: prevManifest, map: current } = loadCatalog(catalogDir)
  const previousTotal = prevManifest?.total ?? 0
  const errors = []
  const stats = {}
  const incoming = new Map()
  const add = (code, row) => incoming.set(code, mergeRows(incoming.get(code), row))

  const open = (kind, url) => (fixtures ? Promise.resolve(createReadStream(join(fixtures, kind))) : httpStream(url, fetchImpl))
  const guard = async (id, fn) => {
    try {
      stats[id] = await fn()
      log(`[${id}] ok`, JSON.stringify(stats[id]))
    } catch (e) {
      errors.push({ source: id, error: String(e.message ?? e).slice(0, 300), at: now.toISOString() })
      log(`[${id}] FALHOU: ${e.message}`)
    }
  }

  let newDeltaTs = state.lastDeltaTs
  if (only.includes('off')) {
    if (mode === 'full') {
      await guard('off-full', async () => readCsv(await open('off.csv.gz', URLS.offCsv), 'f', add))
    } else {
      await guard('off-delta', async () => {
        const index = fixtures ? readFileSync(join(fixtures, 'delta-index.txt'), 'utf8') : await httpText(URLS.offDeltaIndex, fetchImpl)
        const files = pickDeltas(index, state.lastDeltaTs)
        let seen = 0
        let kept = 0
        for (const { f, end } of files) {
          const s = fixtures ? createReadStream(join(fixtures, f)) : await httpStream(URLS.offDeltaBase + f, fetchImpl)
          const r = await readDelta(s, 'f', add)
          seen += r.seen
          kept += r.kept
          newDeltaTs = Math.max(newDeltaTs, end)
        }
        return { files: files.length, seen, kept }
      })
    }
  }
  if (only.includes('obf')) await guard('obf', async () => readCsv(await open('obf.csv.gz', URLS.obfCsv), 'b', add))
  if (only.includes('opf')) await guard('opf', async () => readCsv(await open('opf.csv.gz', URLS.opfCsv), 'p', add))

  const changed = incoming.size > 0
  let published = false
  let problems = []
  if (changed && errors.length < (only.length)) {
    // mescla com o catálogo existente: nunca remove produtos; o mais recente vence
    const merged = new Map(current)
    for (const [code, row] of incoming) merged.set(code, mergeRows(merged.get(code), row))
    const shards = buildShards(merged)
    const version = now.toISOString().slice(0, 10)
    const manifest = buildManifest(shards, { version, generatedAt: now.toISOString(), sources: SOURCES })
    problems = validateCatalog(manifest, (p) => shards.get(p) ?? null, previousTotal)
    if (problems.length === 0) {
      // escreve em pasta temporária e troca de forma atômica
      const tmp = join(dataDir, '.catalog-tmp')
      rmSync(tmp, { recursive: true, force: true })
      mkdirSync(join(tmp, 's'), { recursive: true })
      for (const [prefix, text] of shards) writeFileSync(join(tmp, 's', `${prefix}.json`), text)
      writeFileSync(join(tmp, 'manifest.json'), JSON.stringify(manifest))
      // relê o que foi escrito e valida de novo (integridade em disco)
      const again = validateCatalog(readJson(join(tmp, 'manifest.json'), null), (p) => (existsSync(join(tmp, 's', `${p}.json`)) ? readFileSync(join(tmp, 's', `${p}.json`), 'utf8') : null), previousTotal)
      if (again.length === 0) {
        const keep = ['status.json', 'state.json', 'ATTRIBUTION.md']
        const bak = join(dataDir, '.catalog-prev')
        rmSync(bak, { recursive: true, force: true })
        renameSync(catalogDir, bak)
        renameSync(tmp, catalogDir)
        for (const k of keep) if (existsSync(join(bak, k))) renameSync(join(bak, k), join(catalogDir, k))
        rmSync(bak, { recursive: true, force: true })
        published = true
        writeFileSync(join(catalogDir, 'state.json'), JSON.stringify({ lastDeltaTs: newDeltaTs }))
      } else problems = again
    }
  }
  if (!published) log(changed ? `Catálogo NÃO publicado: ${problems.join('; ') || 'fonte(s) com erro'}` : 'Nada novo.')

  writeFileSync(
    join(catalogDir, 'ATTRIBUTION.md'),
    `# Atribuição\n\nOs dados de produtos vêm de projetos colaborativos abertos, sob a licença ODbL 1.0:\n\n${SOURCES.map((s) => `- ${s.name} — ${s.url}`).join('\n')}\n\nImagens NÃO são importadas. Veja https://opendatacommons.org/licenses/odbl/1-0/\n`,
  )
  const status = {
    runs: (prevStatus.runs ?? 0) + 1,
    lastRunAt: now.toISOString(),
    mode,
    published,
    lastPublishedAt: published ? now.toISOString() : prevStatus.lastPublishedAt ?? null,
    total: published ? [...readdirSync(join(catalogDir, 's'))].length && readJson(join(catalogDir, 'manifest.json'), {}).total : previousTotal,
    stats,
    errors: [...errors, ...problems.map((p) => ({ source: 'validação', error: p, at: now.toISOString() }))].slice(0, 50),
    // histórico curto de falhas para diagnóstico
    recentErrors: [...errors, ...(prevStatus.recentErrors ?? [])].slice(0, 20),
  }
  writeFileSync(statusPath, JSON.stringify(status, null, 2))
  return { published, errors, problems, stats, changed }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dataDir = resolve(args.data ?? '.catalog-work/data')
  const res = await run({
    dataDir,
    mode: args.mode === 'full' ? 'full' : 'delta',
    only: (args.only ?? 'off,obf,opf').split(','),
    fixtures: args.fixtures ? resolve(args.fixtures) : null,
  })
  // Falha de fonte NÃO derruba o job (o catálogo anterior é preservado); só falha se nada pôde ser avaliado.
  console.log(JSON.stringify({ published: res.published, errors: res.errors.length, problems: res.problems.length }))
}
