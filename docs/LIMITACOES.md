# Limitações e validações manuais

## Exigem aparelho real (não declaradas como aprovadas)
- **Safari/iPhone**: câmera (`getUserMedia`), lanterna (não suportada pelo Safari), leitura de código, OCR, instalação "Adicionar à Tela de Início", área segura (notch), teclado virtual. Os testes automatizados usam Chromium com câmera simulada e emulação de viewport.
- **Android/Chrome**: lanterna, `BarcodeDetector` nativo, vibração, instalação (`beforeinstallprompt`).
- Qualidade do OCR com etiquetas/iluminação reais de supermercados (testado com imagem sintética).

## Técnicas
- iOS não expõe vibração (feedback tátil só no Android).
- OCR: primeira leitura baixa ~5 MB do próprio site (cacheados depois, funciona offline apenas após o primeiro uso). Precisão varia com a foto.
- Catálogo automatizado só existe após a primeira execução do robô; até lá, bases públicas (exigem internet). Cobertura brasileira das bases abertas é parcial.
- Dados ficam apenas no aparelho (sem sincronização entre dispositivos): use o backup.
- Preços de etiqueta/histórico são **referência**, nunca tratados como preço atual confirmado.
- Roteamento por *hash* (`#/…`) por causa do GitHub Pages.
- Rota/endereços da calculadora de combustível usam Nominatim/OSRM públicos (limites de uso; exigem internet).
- Este repositório só continha o build minificado da v1: a v2 foi reescrita (React + TypeScript) preservando comportamento e dados.
