# Tarefa 01 · Esqueleto, Dockerfile e landing no ar (backlog 1)

**Status: AGUARDANDO EXECUÇÃO**

- **Tipo:** código (fundação)
- **Data:** 22/09/2026
- **Base:** `docs/t4p-01-especificacao.md` §1, §2 e §5; `docs/t4p-00-estado.md` (backlog 1)

## Objetivo

Deixar o repositório pronto para o Coolify: um app Express que sobe em container, serve a landing atual em `/`, responde `/health`, cria o banco SQLite no volume `/app/data` com o schema completo e já tem os middlewares de segurança. As funcionalidades (cadastro, PIX, admin) ficam para as próximas tarefas. Esta tarefa entrega a base em que elas vão encaixar.

## Mecanismo proposto

Valide contra a especificação. Se houver divergência, reporte.

1. `git init -b main` nesta pasta, caso ainda não seja um repositório. O primeiro commit na `main` contém **só** a documentação e os arquivos-base que já existem (README, CLAUDE.md, docs/, .gitignore, .env.example). Depois crie a branch `tarefa/01-esqueleto` para o código.
2. `package.json` (Node ≥ 20, `"type": "commonjs"`), com as dependências de `CLAUDE.md` e os scripts `start` e `dev`. Gere o `package-lock.json`.
3. `src/db.js`: abre `DB_PATH` (cria a pasta se não existir), `journal_mode = WAL`, `foreign_keys = ON`, aplica o schema da especificação §2 **incluindo** a coluna `token TEXT UNIQUE` em `orders` (citada na §3) e exporta uma função `ping()`.
4. `src/server.js`: `trust proxy`, helmet com a CSP da §5 (conferir as fontes usadas em `public/index.html`), cookie-parser, `express.static('public')`, `GET /health` → `{ok:true, db:true}` usando `ping()`, handler 404 simples, porta via `PORT`.
5. Copie `../../04_Site/index.html` para `public/index.html`, sem alterar o conteúdo.
6. Copie os 10 arquivos listados na §6 para `conteudo/`. Na cópia da Aula 1, troque o CTA final de compra/WhatsApp por um link "Voltar à área do aluno" → `/aluno`. Nenhuma rota serve `conteudo/` nesta tarefa.
7. `Dockerfile`: `node:20-slim`, `WORKDIR /app`, `npm ci --omit=dev` (o better-sqlite3 tem binário pré-compilado; se precisar compilar, use build multi-stage), crie `/app/data` com dono `node`, `USER node`, `EXPOSE 3000`, `CMD ["node","src/server.js"]`. Adicione `.dockerignore` (node_modules, .env, data, docs, .git).
8. Remova os `.gitkeep` das pastas que ficarem com arquivos.

## Fora de escopo

- Rotas de cadastro, login, aluno, admin, checkout e webhook.
- Qualquer chamada ao Mercado Pago.
- Mudanças visuais ou de texto na landing (os avisos âmbar e o `LINK_COMPRA` ficam como estão).
- Deploy no Coolify (é do Guilherme).

## Validação

1. `npm install && npm start` → `curl localhost:3000/health` devolve `{"ok":true,"db":true}`.
2. `curl -s localhost:3000/ | grep -c "IA para Negócios"` > 0.
3. `curl -o /dev/null -w "%{http_code}" localhost:3000/conteudo/IA_para_Negocios_Kit_Completo.pdf` → 404.
4. `sqlite3 "$DB_PATH" ".tables"` (ou um script node) lista `users orders sessions eventos`.
5. Se houver Docker disponível: `docker build` + `docker run` com volume → `/health` ok, e o arquivo `.db` aparece no volume do host. Sem Docker, reporte como "não validado" (não é bloqueio).
6. `git status` limpo na branch; `.env` e `data/` não aparecem no `git ls-files`.
7. A cópia da Aula 1 em `conteudo/` não contém mais `5517000000000`.

## Entrega

- Branch `tarefa/01-esqueleto` com commits pequenos. **Sem push e sem merge**: o Guilherme faz os dois.
- Atualize o backlog em `docs/t4p-00-estado.md` (item 1 → "feito na tarefa 01, aguardando merge").
- Preencha o relatório abaixo e mude o Status para `CONCLUÍDA` ou `BLOQUEADA`.

## Relatório do executor

_(preencher aqui)_
