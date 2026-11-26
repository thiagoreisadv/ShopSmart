# ShopSmart 2.0

**Compre melhor. Economize mais.**
Aplicativo web (PWA) de planejamento de compras, reconhecimento de produtos, comparação de preços e controle financeiro doméstico. Funciona no iPhone, no Android e no desktop, hospedado no GitHub Pages (`/ShopSmart/`), sem servidor e sem serviços pagos.

## Funcionalidades
- **Início**: gasto do mês, orçamento, saldo, ticket médio, economia comprovada, evolução, compras recentes, listas pendentes, mais comprados.
- **Listas**: várias listas, categorias recolhíveis, essenciais, quantidades, notas, itens frequentes, preços por mercado, compartilhamento (WhatsApp), exportar/importar lista.
- **Compra inteligente**: sessão com supermercado/cidade/orçamento, carrinho em tempo real (centavos inteiros, kg/g/L/mL/un, promoções "leve N por R$ X", descontos), alertas 80/90/100 %, recuperação após fechar/atualizar/ficar offline, finalização idempotente.
- **Leitura de etiqueta (OCR local)** com Tesseract.js carregado sob demanda e hospedado no próprio site; recorte, pré-processamento, candidatos de preço e confirmação obrigatória.
- **Leitor de código de barras** (EAN‑13/8, UPC‑A/E, Code 128, QR) com `BarcodeDetector` nativo ou ZXing, lanterna, busca manual, anti‑duplicidade, liberação da câmera.
- **Catálogo**: pessoal (IndexedDB) → catálogo estático ShopSmart (shards) → Open Food/Beauty/Products Facts → cadastro manual. Correções do usuário nunca são sobrescritas.
- **Finanças**: períodos, filtros, categorias, supermercados, comparação de meses, metas, alertas, economia **comprovada** × **estimada**.
- **Mais**: comparador de supermercados (com deslocamento e economia líquida), catálogo, histórico de preços, histórico de compras, calculadoras (preço por unidade e combustível), configurações, backup/restauração.

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
