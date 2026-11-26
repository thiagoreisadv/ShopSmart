# Publicação e restauração

## Estado atual
- A versão publicada (branch `gh-pages`, build da v1) **não foi tocada**. O build da v1 também está em `legacy/v1/`.
- Nada é publicado automaticamente: `deploy.yml` é manual (`workflow_dispatch`, exige digitar `publicar`).

## Publicar a v2
1. Revise e aprove o Pull Request; confirme o CI verde.
2. Mescle na branch principal.
3. *Settings › Pages › Build and deployment › Source*: **GitHub Actions**.
4. *Actions › Publicar no GitHub Pages › Run workflow*, `confirm = publicar`.
5. (Opcional) rode *Atualizar catálogo* com `mode = full` e depois o deploy de novo.
6. Valide manualmente em aparelhos reais (veja `docs/LIMITACOES.md`).

## Restaurar a versão anterior
- **Código**: *Settings › Pages › Source: Deploy from a branch › `gh-pages` / root* (a branch continua com a v1). Ou publique o conteúdo de `legacy/v1/`.
- **Dados dos usuários**: a v2 não altera as chaves `shopsmart_*`; ao voltar para a v1, tudo o que existia antes continua lá. O que foi criado só na v2 (compras, catálogo) não aparece na v1 — por isso peça **Backup completo (JSON)** antes do rollback.
- **Service Worker**: ao voltar para a v1 (sem SW), navegadores com a v2 instalada podem manter o app em cache; o `sw.js` da v2 prioriza a rede para navegação, então a v1 é carregada normalmente. Em último caso: limpar dados do site (apaga também o IndexedDB — exporte o backup antes).
