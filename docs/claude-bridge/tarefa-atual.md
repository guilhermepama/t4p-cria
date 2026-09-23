# Tarefa 01 · Esqueleto, Dockerfile e landing no ar (backlog 1)

**Status: CONCLUÍDA**

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

- **Status:** CONCLUÍDA
- **Feito:**
  - `git init -b main`; primeiro commit só com docs/base; branch `tarefa/01-esqueleto` criada a partir da `main`.
  - `package.json` (Node ≥20, `type: commonjs`, scripts `start`/`dev`) com as 6 dependências mínimas de `CLAUDE.md`; `package-lock.json` gerado com `npm install`.
  - `src/db.js`: cria a pasta de `DB_PATH` se faltar, `journal_mode=WAL`, `foreign_keys=ON`, schema completo da §2 (users, orders — com `token TEXT UNIQUE`, sessions, eventos) e `ping()`.
  - `src/server.js`: `trust proxy`, helmet com CSP customizada (Google Fonts + `unsafe-inline` para o `<style>`/`<script>` inline da landing, `data:` para imagens), cookie-parser, `express.static('public')`, `GET /health` → `{ok,db}`, 404 simples, porta via `PORT`.
  - `public/index.html`: cópia idêntica (`diff` sem saída) de `../../04_Site/index.html`.
  - `conteudo/`: cópia dos 10 arquivos da §6. Na cópia da Aula 1, o CTA final (`#cta-whats`) virou `<a href="/aluno">Voltar à área do aluno</a>`, removida a variável `WHATSAPP` (não usada em mais nada) e a linha de JS que reescrevia o `href` para `wa.me`. Nenhuma outra rota serve `conteudo/`.
  - `Dockerfile` (node:20-slim, `npm ci --omit=dev`, `/app/data` com dono `node`, `USER node`, `EXPOSE 3000`) e `.dockerignore`.
  - `docs/t4p-00-estado.md`: item 1 do backlog marcado como feito.
- **Validação:**
  1. ✅ `npm install && npm start` → `curl localhost:3011/health` → `{"ok":true,"db":true}` (usei a porta 3011 para não conflitar com nada local).
  2. ✅ `curl -s localhost:3011/ | grep -c "IA para Negócios"` → `6`.
  3. ✅ `curl -o /dev/null -w "%{http_code}" localhost:3011/conteudo/IA_para_Negocios_Kit_Completo.pdf` → `404`.
  4. ✅ `node -e "require('./src/db').db..."` listou as 4 tabelas: `eventos orders sessions users`.
  5. ✅ Docker disponível (subi o Docker Desktop): `docker build` passou; `docker run` com volume bind (`/app/data`) → `/health` respondeu `{"ok":true,"db":true}` e `t4p.db`/`-shm`/`-wal` apareceram no diretório do host montado. (Nota: o primeiro `docker run` usou um path Unix-style e o Git Bash/MSYS reescreveu o volume errado, sem gerar erro — reraodei com `MSYS_NO_PATHCONV=1` e path Windows explícito e confirmei via `docker inspect` que o bind ficou correto antes de validar.)
  6. ✅ `git status` limpo na branch (só a doc do backlog e os commits do código); `git ls-files | grep -iE '\.env$|^data/'` não retornou nada; `node_modules/` aparece em `git status --ignored`.
  7. ✅ `grep -n "5517000000000\|WHATSAPP\|wa.me" conteudo/Aula1_O_Pedido_que_Funciona.html` sem resultado.
- **Divergências:**
  - Nenhuma do mecanismo em si. Uma decisão de implementação não detalhada na tarefa: a CSP precisou de `script-src 'unsafe-inline'` e `style-src 'unsafe-inline'` além de `fonts.googleapis.com`/`fonts.gstatic.com`, porque `public/index.html` tem `<style>` e dois blocos `<script>` inline sem nonce (não alterei o HTML, então ajustei a política em vez de quebrar a landing). Se preferirem CSP mais restritiva, isso exige migrar a landing para nonce/hash — decisão de produto/arquitetura, não tomei sozinho.
  - Na cópia da Aula 1, troquei só o link e o JS que apontava para o WhatsApp (`#cta-whats`, `WHATSAPP`, `PRECO` mantido). Não toquei no texto da oferta ao redor ("Isso foi a aula 1...", preço, parágrafos) porque a tarefa pediu só a troca do CTA, e texto de oferta é decisão de produto.
- **Achados** (fora do escopo, não corrigidos):
  - `npm audit` acusa 1 vulnerabilidade crítica e 1 alta em `tar`/`@mapbox/node-pre-gyp`, dependência transitiva de build do `bcrypt` (usada só durante `npm install` para baixar binário pré-compilado, não em runtime). `npm audit fix` não resolve sem `--force`, que trocaria a major do `bcrypt`. Deixei como está; se quiserem resolver, é uma decisão de dependência que passa pelo dono do produto.
  - `public/` estruturalmente só tem `index.html` por enquanto; a especificação (§1) menciona favicon e og-image, que ainda não existem em `04_Site/` — não é bloqueio desta tarefa, mas falta esse asset para o `og:image`/favicon funcionarem quando o site for divulgado.
- **Commit/branch:** branch `tarefa/01-esqueleto` (a partir de `main`, commit raiz `591bb00`). Commits: `e677d4e` (esqueleto Express+db+landing), `a5bb16d` (conteúdo do kit), `a6b7e62` (Dockerfile), `37714b8` (backlog). Sem push, sem merge.
