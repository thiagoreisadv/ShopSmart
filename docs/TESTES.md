# Testes e validação

Resultados reais, executados neste repositório (Node 22, Chromium do Playwright):

| Camada | Ferramenta | Resultado |
|---|---|---|
| ESLint | `npm run lint` | sem erros |
| Tipos | `npm run typecheck` | sem erros |
| Unitários / integração / robô | Vitest (`npm test`) | **165 aprovados** (14 arquivos) |
| E2E (iPhone 13, Pixel 7, iPad, desktop 1280×800) | Playwright | **133 de 136 na execução completa; as 3 falhas (OCR em perfis mobile, recorte cortando o título) foram corrigidas e reexecutadas: 3/3 aprovados** |

## Cobertura
- **Unitários**: dinheiro em centavos, unidades/peso, GTIN/EAN/UPC, decodificação ZXing de imagem sintética, parser de etiquetas BR (R$ 12,99; 1.299,90; /kg; /un; "3 por R$ 10"; datas, códigos, parcelas, preço antigo), pré‑processamento de imagem, carrinho, orçamento 80/90/100 %, finanças, economia comprovada × estimada, histórico de preços, comparador, migração da v1 (11 casos), backup/restauração/CSV, consulta de código (cache, timeout, fallback, offline, integridade de shard), robô de catálogo (pipeline com fixtures, falhas de fonte, validação).
- **Integração (store + IndexedDB)**: sessão de compra, recuperação após recarregar, finalização idempotente, cancelamento, aprendizado de produtos, correção do usuário preservada.
- **E2E**: navegação/responsividade/sem rolagem horizontal nas 13 rotas, tema claro/escuro, migração com dados reais da v1, fluxo completo de compra, listas, comparador, calculadoras, backup, PWA (offline e atualização sem perder a compra), leitor de código com **câmera simulada** (getUserMedia real + ZXing) e **OCR real** (Tesseract auto‑hospedado) sobre imagem de etiqueta gerada.

## Não validado automaticamente (exige aparelho real)
Safari/iPhone, lanterna, vibração, instalação nativa, OCR com etiquetas reais, robô com as fontes reais (ambiente sem acesso externo). Ver `docs/LIMITACOES.md`.
