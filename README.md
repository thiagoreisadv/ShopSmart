# ShopSmart 2.0

**Compre melhor. Economize mais.**
Aplicativo web (PWA) de planejamento de compras, reconhecimento de produtos, comparação de preços e controle financeiro doméstico. Funciona no iPhone, no Android e no desktop, hospedado no GitHub Pages (`/ShopSmart/`), sem servidor e sem serviços pagos.

## Funcionalidades (v2.1 — interface simplificada)
Navegação com 4 destinos: **Início, Listas, Comprar, Gastos**. Configurações na engrenagem do cabeçalho.
- **Início**: gasto do mês com limite e saldo, botão Iniciar/Continuar compra, listas recentes e ferramentas rápidas (comparar preços, preço por unidade, combustível).
- **Listas**: Lista · Preços · **Comparar** (comparador de supermercados integrado), múltiplas listas, itens frequentes, exportar/importar.
- **Comprar**: total e orçamento restante sempre visíveis, ação principal **Escanear** ao alcance do polegar, edição em bottom sheet, menu contextual (orçamento, categorias, lista vinculada, cancelar), sessão recuperável.
- **Câmera unificada**: código de barras detectado continuamente (leve); OCR de etiqueta só ao tocar em *Ler etiqueta* (ou foto da galeria); confirmação rápida; vários produtos em sequência; digitação manual sempre disponível.
- **Gastos**: resumo (período, categorias, supermercados, metas, alertas) e aba **Compras** (histórico, CSV).
- **Configurações**: aparência, animações, privacidade, **backup e restauração**, acesso ao **catálogo de produtos** (com **histórico de preços** por produto).
- Mantidos: OCR, ZXing, IndexedDB, migrações, robô de catálogo, PWA offline, calculadoras.
Links antigos (`#/financas`, `#/mais/...`) redirecionam para as novas rotas.

## Desenvolvimento
```bash
npm ci
npm run dev           # http://localhost:5173/ShopSmart/
npm run lint && npm run typecheck && npm test
npm run test:e2e      # build + Playwright (iPhone, Android, tablet, desktop)
npm run build         # gera dist/ (base /ShopSmart/)
```
Para o Playwright local use o Chromium já instalado: `PW_CHROMIUM=/caminho/chromium npm run test:e2e`.

## Estrutura
```
src/
  domain/    regras de negócio puras (carrinho, finanças, preços, comparador, catálogo)
  lib/       dinheiro em centavos, unidades, GTIN, parser OCR de etiquetas brasileiras
  storage/   IndexedDB, migrações versionadas, backup/restauração, leitura (somente leitura) da v1
  store/     estado global + ações (gravação em fila, sessões, finalização)
  services/  consulta de código de barras, OCR (pré-processamento + motor), decodificação ZXing
  components/ screens/ hooks/ styles/   interface
scripts/catalog/   robô do catálogo (GitHub Actions)
e2e/               testes Playwright
legacy/v1/         build da versão anterior (referência e rollback)
docs/              documentação detalhada
```

## Documentação
- [Migração de dados](docs/MIGRACAO.md)
- [Robô do catálogo de produtos](docs/ROBO-CATALOGO.md)
- [Testes e validação](docs/TESTES.md)
- [Publicação e restauração da versão anterior](docs/PUBLICACAO.md)
- [Limitações conhecidas e validações manuais](docs/LIMITACOES.md)

## Licenças e fontes de dados
Dados de produtos: Open Food Facts, Open Beauty Facts e Open Products Facts (ODbL 1.0; atribuição obrigatória, exibida em Configurações e em `catalog/ATTRIBUTION.md`). Nenhuma imagem de produto é importada.
Criado por Thiago de Souza Reis.
