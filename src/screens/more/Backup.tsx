import { useRef, useState } from 'react'
import { Page } from '@/components/Page'
import { Badge, Banner, Button, Card } from '@/components/ui'
import { Sheet, ConfirmDialog } from '@/components/Sheet'
import { createLogicalBackup, dumpAll, importLegacyListFile, listLogicalBackups, parseBackup, purchasesToCsv, readLogicalBackup, restoreBackup, type ParseResult } from '@/storage/backup'
import { reimportLegacy } from '@/storage/migrations'
import { getAll } from '@/storage/db'
import { reloadFromDb } from '@/store/actions'
import { downloadText } from '@/lib/download'
import { toast } from '@/store/ui'
import { formatDateTime } from '@/lib/dates'
import type { Purchase } from '@/domain/types'
import { useEffect } from 'react'

export default function Backup() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<{ name: string; r: ParseResult } | null>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [busy, setBusy] = useState(false)
  const [backups, setBackups] = useState<{ key: string; at: number; reason: string }[]>([])
  useEffect(() => { void listLogicalBackups().then(setBackups) }, [parsed, busy])

  const exportJson = async () => {
    const f = await dumpAll(localStorage)
    downloadText(`shopsmart-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(f, null, 2))
    toast('Backup exportado', 'success')
  }
  const exportCsv = async () => {
    downloadText(`shopsmart-financeiro-${new Date().toISOString().slice(0, 10)}.csv`, purchasesToCsv(await getAll<Purchase>('purchases')), 'text/csv;charset=utf-8')
    toast('CSV exportado', 'success')
  }
  const pick = async (f: File) => {
    const r = parseBackup(await f.text())
    setParsed({ name: f.name, r })
    setMode('merge')
  }
  const apply = async () => {
    if (!parsed?.r.ok) return
    setBusy(true)
    try {
      if (parsed.r.legacyList) {
        const m = await importLegacyListFile(parsed.r.legacyList)
        toast(`Lista “${m.name}” importada`, 'success')
      } else if (parsed.r.file) {
        const rep = await restoreBackup(parsed.r.file, mode, localStorage)
        toast(`Restaurado: ${rep.added} novos, ${rep.updated} atualizados, ${rep.skippedDuplicates} duplicados ignorados`, 'success')
      }
      await reloadFromDb()
      setParsed(null)
    } catch (e) {
      console.error(e)
      toast('Não foi possível restaurar. Seus dados atuais não foram alterados.', 'error')
    } finally {
      setBusy(false)
    }
  }
  const restoreInternal = async (key: string) => {
    const f = await readLogicalBackup(key)
    if (!f) return
    setParsed({ name: 'Backup interno', r: { ok: true, file: f, warnings: [], summary: { lists: f.data.listsMeta?.length ?? 0, products: f.data.products.length, purchases: f.data.purchases.length, prices: f.data.prices.length, supermarkets: f.data.supermarkets?.length ?? 0 } } })
    setMode('replace')
  }

  return (
    <Page title="Backup e restauração" subtitle="Seus dados ficam neste aparelho" backTo="/mais">
      <Card className="stack">
        <h2 style={{ fontSize: 16 }}>Exportar</h2>
        <p className="small muted">Guarde uma cópia: listas, produtos, supermercados, preços, compras, configurações e orçamentos.</p>
        <div className="grid-2"><Button variant="primary" icon="Download" onClick={exportJson}>Backup completo (JSON)</Button><Button icon="FileText" onClick={exportCsv}>Financeiro (CSV)</Button></div>
      </Card>
      <Card className="stack">
        <h2 style={{ fontSize: 16 }}>Importar</h2>
        <p className="small muted">Aceita backups do ShopSmart 2.0 e listas exportadas pela versão anterior.</p>
        <Button icon="Upload" onClick={() => fileRef.current?.click()}>Escolher arquivo</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = '' }} />
      </Card>
      <Card className="stack">
        <h2 style={{ fontSize: 16 }}>Dados da versão anterior</h2>
        <p className="small muted">A versão 1 continua intacta no aparelho. Se você usou a versão antiga depois de migrar, traga o que faltou — sem apagar nem duplicar nada.</p>
        <Button icon="RefreshCw" onClick={async () => { setBusy(true); const r = await reimportLegacy(localStorage); await reloadFromDb(); setBusy(false); toast(r.lists || r.purchases ? `Importados: ${r.lists} listas, ${r.purchases} compras` : 'Nada novo para importar', 'info') }} disabled={busy}>Reimportar dados da v1</Button>
      </Card>
      {backups.length > 0 && (
        <Card className="stack">
          <h2 style={{ fontSize: 16 }}>Cópias de segurança automáticas</h2>
          <p className="small muted">Criadas antes de migrações e restaurações. As 3 mais recentes são mantidas.</p>
          <div className="list">{backups.map((b) => (
            <div key={b.key} className="list-item"><div className="grow small"><b>{formatDateTime(new Date(b.at).toISOString())}</b><div className="xs muted">{b.reason.replace(/-/g, ' ')}</div></div><Button size="sm" onClick={() => void restoreInternal(b.key)}>Restaurar</Button></div>
          ))}</div>
        </Card>
      )}

      <Sheet open={!!parsed} onClose={() => setParsed(null)} title="Importar backup" footer={parsed?.r.ok ? <Button variant={mode === 'replace' ? 'danger' : 'primary'} block disabled={busy} onClick={() => (mode === 'replace' && !parsed.r.legacyList ? setConfirmReplace(true) : void apply())}>{parsed.r.legacyList ? 'Importar lista' : mode === 'merge' ? 'Mesclar com meus dados' : 'Substituir meus dados'}</Button> : undefined}>
        {parsed && (
          <div className="stack">
            <p className="small muted">{parsed.name}</p>
            {!parsed.r.ok ? <Banner tone="danger">{parsed.r.error}</Banner> : (
              <>
                <div className="row-s wrap"><Badge>{parsed.r.summary!.lists} listas</Badge><Badge>{parsed.r.summary!.purchases} compras</Badge><Badge>{parsed.r.summary!.products} produtos</Badge><Badge>{parsed.r.summary!.prices} preços</Badge></div>
                {parsed.r.warnings.map((w) => <Banner key={w} tone="warn">{w}</Banner>)}
                {!parsed.r.legacyList && (
                  <div className="stack-s">
                    <button className={`card flat tight ${mode === 'merge' ? '' : ''}`} style={{ textAlign: 'left', borderColor: mode === 'merge' ? 'var(--primary)' : undefined }} onClick={() => setMode('merge')}><b>Mesclar</b><div className="xs muted">Soma ao que já existe. Registros repetidos são ignorados.</div></button>
                    <button className="card flat tight" style={{ textAlign: 'left', borderColor: mode === 'replace' ? 'var(--danger)' : undefined }} onClick={() => setMode('replace')}><b>Substituir tudo</b><div className="xs muted">Apaga os dados atuais e usa os do arquivo. Uma cópia de segurança é criada antes.</div></button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Sheet>
      <ConfirmDialog open={confirmReplace} danger title="Substituir todos os dados?" message="Listas, compras e preços atuais serão substituídos pelos do arquivo. Criaremos uma cópia de segurança antes, que você poderá restaurar depois." confirmLabel="Substituir" onCancel={() => setConfirmReplace(false)} onConfirm={() => { setConfirmReplace(false); void apply() }} />
      <Button variant="ghost" size="sm" onClick={async () => { await createLogicalBackup('manual', localStorage); setBackups(await listLogicalBackups()); toast('Cópia de segurança criada neste aparelho', 'success') }}>Criar cópia de segurança agora</Button>
    </Page>
  )
}
