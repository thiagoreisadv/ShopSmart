# Robô do catálogo de produtos

Atualiza um catálogo **público e sem dados pessoais** de produtos vendidos no Brasil, consumido pelo app como arquivos estáticos (compatível com GitHub Pages).

## Fontes (somente exportações oficiais, ODbL)
- Open Food Facts: exportação CSV completa (modo `full`) e **deltas diários** oficiais (modo `delta`, padrão).
- Open Beauty Facts e Open Products Facts: exportações CSV (pequenas).
- Nenhum scraping de supermercados. Nenhuma imagem é importada. `User-Agent` identificado, tentativas com *backoff*.

## Pipeline (`scripts/catalog/`)
1. Lê as fontes em *streaming* (gzip) e filtra: país Brasil **ou** prefixo GS1 789/790.
2. Valida GTIN (dígito verificador), normaliza nome (caixa alta → título, espaços), marca, categoria (mesmas regras do app), tamanho.
3. Remove duplicados: o registro **mais recente** vence, lacunas são preenchidas; preserva `fonte` e `data`.
4. **Mescla** com o catálogo atual (nunca remove produtos).
5. Gera *shards* por prefixo do EAN‑13 (5 dígitos; divide em 6/7 se > 250 KB) + `manifest.json` (versão, total, `sha256` por shard, fontes/licenças).
6. **Valida** (hash, contagem, GTIN, tamanho, queda > 20 %) e só então troca a pasta de forma atômica. `status.json` registra erros e execuções.
7. Fonte indisponível, CSV truncado/corrompido ou validação reprovada ⇒ **catálogo anterior preservado**; erro registrado.

## No app
`manifest.json` (pequeno) → consulta ao shard do código → verificação do `sha256` → cache em IndexedDB. Sem carregar JSON gigante na inicialização. Fallback: bases públicas.

## GitHub Actions
- `.github/workflows/catalog-update.yml`: **diário (05:17 UTC)** + `workflow_dispatch` (`delta`/`full`). Salva na branch órfã `catalog-data` (não polui a branch principal), dispara o deploy se houve mudança.
- Repositórios inativos: o GitHub desativa agendamentos após 60 dias sem atividade. Mitigações: `status.json` muda a cada execução (commit diário em `catalog-data`) e o último passo executa `gh workflow enable`. Se ainda assim parar, rode manualmente em *Actions › Atualizar catálogo › Run workflow*.
- **Primeira carga**: execute manualmente com `mode = full` (baixa ~1 GB; ~30–60 min).

## Execução local
```bash
node scripts/catalog/build.mjs --data .catalog-work/data --mode delta
npm run catalog:test
```
> Observação: este ambiente de desenvolvimento não tem acesso às fontes externas; o pipeline foi validado com fixtures (CSV/JSONL gz). A primeira execução real deve ser acompanhada em *Actions*.
