# Migração de dados (v1 → v2)

## O que a v1 gravava
Tudo em `localStorage`, chaves `shopsmart_*`:

| Chave | Conteúdo |
|---|---|
| `shopsmart_lists_meta` | `[{id,name,createdAt}]` |
| `shopsmart_active_list` | id da lista ativa |
| `shopsmart_list_<id>_markets` | `[{id,name,discountPercent}]` (se ausente, "Mercado A/B" padrão) |
| `shopsmart_list_<id>_products` | itens: `{id,name,quantity,prices{mercado:"12.50"},category,isEssential,inCart,note}` |
| `shopsmart_list_<id>_budget` | orçamento (texto) |
| `shopsmart_list_<id>_history` | `[{id,date,marketName,total,itemCount,boughtCount}]` |
| `shopsmart_frequent_items` | `{nome:{name,category,count}}` |
| `shopsmart_calc`, `_eth`, `_gas`, `_dist`, `_cons`, `_tfp`, `_roundtrip`, `_theme` | calculadoras e tema |

(Formatos obtidos do código da v1 publicada; o repositório só continha o build minificado.)

## Estratégia
1. **A v2 nunca grava, altera ou apaga chaves da v1.** Elas são lidas apenas. Rollback para a v1 não perde nada que existia antes da migração.
2. Calculadoras e tema **continuam nas mesmas chaves** (mesmo formato), então são compartilhados entre v1 e v2.
3. Listas, histórico, itens frequentes e demais dados vão para o **IndexedDB** (`shopsmart-v2`).
4. Migrações **versionadas** (`src/storage/migrations.ts`), **idempotentes** (ids determinísticos, "mesclar sem sobrescrever") e gravadas uma a uma em `meta.schemaVersion`:
   - 1 `importar-listas-da-v1`: listas, mercados, produtos, orçamento.
   - 2 `importar-historico-e-itens-frequentes`: cada entrada de histórico vira compra finalizada `legacy-<lista>-<id>` (sem itens; entra nas finanças como "Não detalhado"); itens frequentes viram sugestões e catálogo pessoal; mercados com nome próprio viram supermercados.
5. **Backup lógico antes de migrar**: cópia bruta das chaves da v1 (`legacyRawBackup`, nunca sobrescrita) e, em migrações futuras, snapshot completo do IndexedDB (mantém os 3 últimos).
6. Falhas: JSON corrompido em uma chave é ignorado (a lista vem vazia) sem derrubar a migração; sem IndexedDB o app abre em memória com aviso.
7. Em **Mais › Backup e restauração** há "Reimportar dados da v1" (adiciona só o que falta; nunca duplica nem sobrescreve).

## Testes
`tests/unit/migrations.test.ts` (11 casos) e `e2e/migration.spec.ts` (4 cenários com dados reais da v1 semeados antes do primeiro carregamento).
