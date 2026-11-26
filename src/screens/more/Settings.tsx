import { Page } from '@/components/Page'
import { Banner, Card, Segmented, Switch, TextInput } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { useAppState } from '@/store/store'
import { updateSettings } from '@/store/actions'
import { useTheme, type ThemeChoice } from '@/hooks/useTheme'
import { usePwa, applyUpdate } from '@/hooks/usePwa'
import { Button } from '@/components/ui'
import BackupSection from './Backup'

export default function Settings() {
  const s = useAppState((st) => st.settings)
  const { choice, setChoice } = useTheme()
  const pwa = usePwa()
  return (
    <Page title="Configurações" backTo="/" noGear>
      <Card className="stack">
        <h2 style={{ fontSize: 16 }}>Aparência</h2>
        <Segmented<ThemeChoice> value={choice} onChange={setChoice} label="Tema" options={[{ value: 'system', label: 'Sistema' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Escuro' }]} />
        <div className="field"><label className="label">Animações</label>
          <Segmented value={s.reducedMotion} onChange={(v) => updateSettings({ reducedMotion: v })} label="Animações" options={[{ value: 'system', label: 'Sistema' }, { value: 'off', label: 'Ativas' }, { value: 'on', label: 'Reduzidas' }]} />
          <span className="hint">“Sistema” respeita a opção de reduzir movimento do seu aparelho.</span></div>
        <div className="row between"><div><div className="bold small">Feedback tátil</div><div className="xs muted">Vibração leve ao tocar e ler códigos (quando o aparelho suporta)</div></div><Switch checked={s.haptics} onChange={(v) => updateSettings({ haptics: v })} label="Feedback tátil" /></div>
      </Card>
      <Card className="stack">
        <h2 style={{ fontSize: 16 }}>Compras</h2>
        <TextInput label="Cidade padrão" value={s.defaultCity} onChange={(e) => updateSettings({ defaultCity: e.target.value })} placeholder="Ex.: Loanda" />
        <div className="row between"><div><div className="bold small">Consultar bases públicas</div><div className="xs muted">Open Food Facts, Open Beauty Facts e Open Products Facts ao ler um código novo. O código lido é enviado a esses serviços.</div></div><Switch checked={s.catalogLookupExternal} onChange={(v) => updateSettings({ catalogLookupExternal: v })} label="Consultar bases públicas" /></div>
      </Card>
      <section className="stack" id="backup" aria-label="Backup e restauração">
        <h2 style={{ fontSize: 16 }}>Backup e restauração</h2>
        <BackupSection />
      </section>
      <Card className="stack">
        <h2 style={{ fontSize: 16 }}>Privacidade</h2>
        <p className="small muted">Seus dados (listas, compras, preços, orçamentos) ficam somente neste aparelho. Fotos de etiquetas são lidas no próprio aparelho e descartadas logo depois — nada é enviado nem guardado.</p>
      </Card>
      <Card className="stack">
        <h2 style={{ fontSize: 16 }}>Aplicativo</h2>
        <div className="row between small"><span className="muted">Versão</span><b>ShopSmart 2.0</b></div>
        <div className="row between small"><span className="muted">Instalado como app</span><b>{pwa.standalone ? 'Sim' : 'Não'}</b></div>
        {pwa.updateReady && <Button variant="primary" icon="RefreshCw" onClick={applyUpdate}>Atualizar agora</Button>}
        {pwa.canInstall && <Button variant="primary" icon="Download" onClick={() => void pwa.install()}>Instalar no aparelho</Button>}
        {pwa.ios && !pwa.standalone && <Banner tone="info" icon="Smartphone">No iPhone: toque em <b>Compartilhar</b> <Icon name="Share2" size={14} /> no Safari e depois em <b>Adicionar à Tela de Início</b>.</Banner>}
        <p className="xs muted">Dados de produtos: Open Food Facts, Open Beauty Facts e Open Products Facts (© colaboradores, licença ODbL).</p>
        <p className="xs muted">Criado por Thiago de Souza Reis.</p>
      </Card>
    </Page>
  )
}
