# Tarefa 10 — Avanço nas aulas e check de download na área do aluno

**Status: CONCLUÍDA**

- Tipo: código (db + rotas + templates + snippet nas aulas + e2e). Sem dependência nova.
- Data: 23/09/2026
- Base: tarefas 01–09 concluídas e mergeadas (`origin/main` em `12c0759`). As aulas já estão com o tema da 09 e o e2e tem `percorrerAula1Tema/2Tema/3Tema`: reaproveite esses percursos para os passos de progresso em vez de escrever outros.
- Antes de criar a branch: a working tree está na `tarefa/09-visual-aulas` com esta tarefa e `concluidas/09-visual-aulas.md` não versionadas. Leve-as para a nova branch e faça o commit `docs: planejador — tarefa 10` primeiro, como na 09.
- ⚠️ Produção vendendo até sexta 25/09 às 14h. Não tocar checkout, webhook, /pagamento, VENDAS_ATE. Migração **só aditiva** (tabela nova); nenhuma coluna ou dado existente muda.

## Objetivo

1. O aluno vê o próprio avanço: em cada aula, "Passo X de Y" ou "✓ Concluída"; em cada arquivo, "✓ Baixado" em verde.
2. O Guilherme vê o uso real no /admin (quantos abriram/concluíram cada aula, quantos baixaram cada arquivo). Serve para o pitch de impacto e o balanço do Empretec.

## Decisões de produto que não mudam

- **Sem "continuar de onde parou"** nesta tarefa. Os passos das aulas têm travas e o exercício final depende de estado da própria página; pular para o passo N pode abrir tela quebrada. "Abrir aula" continua abrindo do começo.
- Progresso **no servidor**, não em localStorage (vale entre aparelhos e alimenta o /admin).
- Download registra "baixou", não "abriu". É o suficiente para o check.

## Mecanismo proposto

Validar contra o código real. Se divergir, reporte.

1. **Banco (`src/db.js`, única camada com SQL)**
   - `CREATE TABLE IF NOT EXISTS progresso (user_id INTEGER NOT NULL REFERENCES users(id), item TEXT NOT NULL, tipo TEXT NOT NULL CHECK (tipo IN ('aula','download')), passo INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL DEFAULT 0, concluido INTEGER NOT NULL DEFAULT 0, primeiro_em TEXT NOT NULL DEFAULT (datetime('now')), atualizado_em TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (user_id, item))`.
   - Funções: `registrarDownload(userId, arquivo)`, `registrarPassoAula(userId, arquivo, passo, total)`, `progressoDoAluno(userId)` → Map por item, `resumoProgresso()` → contagens por item para o /admin.
   - Regra do passo: guardar o **maior** passo já alcançado (`MAX(passo, excluded.passo)`), para "Voltar" não regredir. `concluido = 1` quando `passo >= total`, e nunca volta a 0.

2. **Download (`GET /aluno/conteudo/:arquivo`)** — quando `tipo === "download"`, chamar `registrarDownload` antes do `res.download`. Aulas (html) **não** contam como avanço aqui; avanço de aula só pelo POST abaixo.

3. **Rota `POST /aluno/progresso`** (`auth.requireAluno` + a mesma checagem de Origin/Referer = BASE_URL dos outros POSTs)
   - Corpo JSON `{ aula, passo, total }`. Validar: `aula` pertence a `AULAS` (whitelist por nome de arquivo), `passo` e `total` inteiros com `0 <= passo <= total <= 30`. Qualquer outra coisa → 400.
   - Resposta 204. Rate limit leve (ex.: 120/min por sessão), reaproveitando o `express-rate-limit` existente.
   - `express.json({ limit: "1kb" })` só nessa rota, se o JSON ainda não estiver habilitado.

4. **Snippet nas 3 aulas (`conteudo/*.html`)** — o menor trecho possível dentro do `<script>` existente:
   - Uma função `salvarProgresso()` que faz `fetch("/aluno/progresso", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ aula: "<nome do arquivo>", passo: atual, total: total }), credentials: "same-origin", keepalive: true })` e **engole qualquer erro** (`.catch(function(){})`). A aula nunca pode travar ou mostrar erro por causa disso.
   - Chamar `salvarProgresso()` no fim de `ir(i)`, só quando `i > 0`.
   - Atenção: nas aulas, `total` já é o **último índice** (`steps.length - 1`), então chegar ao passo final = `passo === total` = concluída.
   - O "Passo X de Y" do /aluno tem que bater com o que a barra da própria aula mostra (ex.: Aula 1 = "de 11"). Conferir como `atualizarBarra()` numera e usar a mesma conta.
   - Nenhuma outra linha do script muda. Mostrar no relatório o diff dos `<script>` (esperado: ~10 linhas por aula).

5. **`/aluno` (`src/server.js` + `src/views/aluno.html`)**
   - Cartão da aula: abaixo do título, uma barrinha fina (trilho `--line`, preenchimento com o degradê da landing) e o texto "Passo X de Y" (muted, 13.5px). Concluída: selo "✓ Concluída" verde (`#4ade80`) e barra cheia. Nunca aberta: "Não iniciada" (muted), sem barra. O botão continua "Abrir aula"; quando concluída pode virar "Rever aula".
   - Linha de download: se já baixado, mostrar "✓ Baixado" verde antes do link, e o link vira "Baixar de novo" (muted). Script inline pequeno: no clique em "Baixar", trocar na hora para o estado baixado (sem recarregar).
   - As aulas abrem em nova aba (`target="_blank"`). Ao voltar à aba do /aluno, atualizar os cartões: no `visibilitychange` (visível), `location.reload()` é aceitável; alternativa melhor, se for simples: `GET /aluno/progresso.json` e atualizar só os cartões. Escolha e justifique no relatório.
   - Manter o visual atual da página (tokens da landing). Nada de layout novo além disso.

6. **/admin** — um bloco "Uso do conteúdo" com uma tabela simples: item | alunos que abriram/baixaram | concluíram (só aulas) | % sobre alunos ativos. Sem nomes de alunos nessa tabela. O CSV atual do balanço não muda.

7. **`/privacidade`** — acrescentar uma frase: registramos o avanço nas aulas e quais arquivos você baixou, só para mostrar seu progresso e medir o uso do curso; não compartilhamos. (Texto final pode ser ajustado, sem prometer nada além disso.)

## Fora de escopo

- Retomar a aula no passo salvo, certificados, e-mails, gamificação.
- Mudar a navegação, as travas ou o conteúdo das aulas.
- Qualquer mudança em checkout, webhook, /pagamento, VENDAS_ATE, CSV do balanço.

## Validação

- [ ] Migração em banco existente (cópia do `data/t4p.db` local): sobe sem erro, dados antigos intactos, tabela `progresso` criada. Rodar duas vezes (idempotente).
- [ ] Playwright, aluno ativo: abrir Aula 1, avançar até o passo 3 → `/aluno` mostra "Passo 3 de 10" (ou o total real). Voltar para o passo 1 → continua 3. Ir até o final → "✓ Concluída".
- [ ] Download de 1 arquivo → "✓ Baixado" aparece na hora e persiste após reload; outro aluno não vê esse check.
- [ ] `POST /aluno/progresso` sem sessão → 401/redirect; com `aula` fora da whitelist, `passo > total` ou `total > 30` → 400; sem Origin válido → 403.
- [ ] Aula aberta com o servidor derrubado/POST falhando: navegação segue normal, sem erro visível (console pode ter o fetch falho, nada mais).
- [ ] Diff dos `<script>` das aulas restrito ao snippet.
- [ ] /admin mostra o bloco "Uso do conteúdo" com números coerentes com o teste.
- [ ] Prints do /aluno (desktop 1280 e 390px) nos estados: não iniciada, em andamento, concluída; baixado e não baixado.
- [ ] e2e completo verde com os passos novos no `scripts/e2e.js`.

## Entrega

- Branch `tarefa/10-progresso-aluno` a partir da `main` atualizada (já com 08 e 09).
- PR com base em `main`, **sem merge**. Prints e resultado do e2e na descrição.
- `docs/t4p-00-estado.md`: decisão "23/09 · Progresso do aluno no servidor (aulas + downloads), sem retomar passo" e item no backlog.
- Preencher o relatório e mudar o Status.

## Relatório do executor

- **Status:** CONCLUÍDA
- **Feito:**
  - `src/db.js`: tabela `progresso` (`CREATE TABLE IF NOT EXISTS`, aditiva) + `registrarDownload`, `registrarPassoAula` (upsert com `MAX(passo, excluded.passo)` e `concluido = MAX(concluido, excluded.concluido)`, nunca regride), `progressoDoAluno`, `resumoProgresso`, `contarAlunosAtivos`.
  - `src/server.js`: `POST /aluno/progresso` (whitelist de aula, `0 ≤ passo ≤ total ≤ 30`, rate-limit de 120/min por aluno via `keyGenerator`), `GET /aluno/progresso.json`, download registrado em `GET /aluno/conteudo/:arquivo` antes do `res.download`, cartões de aula/downloads em `/aluno` com o progresso real, bloco "Uso do conteúdo" em `/admin`.
  - `conteudo/Aula{1,2,3}*.html`: função `salvarProgresso()` + chamada `if (i > 0) salvarProgresso();` no fim de `ir(i)` (10-11 linhas por aula, diff isolado).
  - `src/views/aluno.html`: barra de progresso, selo "✓ Concluída", "✓ Baixado"/"Baixar de novo", script inline (visibilitychange → `GET /aluno/progresso.json` → atualiza só os cartões; clique em "Baixar" → estado otimista).
  - `src/views/admin.html`: tabela "Uso do conteúdo" (item | abriram/baixaram | concluíram | % dos alunos ativos), sem nomes de alunos.
  - `src/views/privacidade.html`: frase sobre o registro de avanço/downloads.
  - `scripts/e2e.js`: reaproveita `percorrerAula1Tema/2Tema/3Tema` (tarefa 09) para validar "✓ Concluída" ao final da cadeia 1440px; casos novos e dedicados para avanço parcial + não regressão ao voltar, download com check otimista/persistência/isolamento entre alunos, validação 302/403/400 do `POST /aluno/progresso`, POST falhando sem quebrar a navegação, e números do bloco `/admin`. Prints em `docs/claude-bridge/evidencias/tarefa-10-progresso/`.
  - `docs/t4p-00-estado.md`: decisão do dia + item 8 no backlog.
- **Validação:**
  - [✅] Migração idempotente em cópia do banco local: rodei `DB_PATH=<cópia> node -e "require('./src/db')"` duas vezes seguidas — `users`/`orders` intactos (1 e 0, antes e depois), tabela `progresso` criada na 1ª e mantida na 2ª. Testei também `registrarPassoAula` com passo menor depois de maior (fica no maior) e `concluido` permanecendo 1 depois de uma tentativa de regressão.
  - [✅] Playwright, aluno ativo: teste dedicado avança a Aula 1 até o passo 3 (`#comecar` + 2×`continuarQuandoLiberado`), confere "Passo 3 de {total real, 11}" em `/aluno`, clica "Voltar" (vai para o passo 2) e confere que `/aluno` continua em "Passo 3 de 11" depois de recarregar. A conclusão ("✓ Concluída") é conferida ao final da cadeia 1440px que já percorre Aula 1→2→3 até o fim (reaproveitando `percorrerAulaXTema`, como pedido).
  - [✅] Download de 1 arquivo (`assistente_vendas.txt`): "✓ Baixado" aparece na hora do clique (`waitForEvent("download")` + checagem síncrona), persiste após `reload()`, e um segundo aluno logado não vê o check no mesmo arquivo.
  - [✅] `POST /aluno/progresso`: sem sessão → 302 para `/entrar` (`maxRedirects: 0`); `aula` fora da whitelist, `passo > total`, `total > 30` e `passo < 0` → 400 (4 casos); sem Origin válido → 403.
  - [✅] Aula com o POST falhando (`page.route(...).abort()` em `**/aluno/progresso`): navegação segue normal (passo avança na tela, `#continuar`/`#voltar` continuam funcionando), sem erro de página (`pageerror`) — só a falha de rede, que é engolida pelo `.catch()`.
  - [✅] Diff dos `<script>` das aulas restrito ao snippet — `git diff conteudo/` mostra só a função `salvarProgresso()` e a linha `if (i > 0) salvarProgresso();` em cada aula (11 linhas cada).
  - [✅] `/admin` mostra "Uso do conteúdo" com números coerentes: Aula 1 com ≥2 alunos (aluno concluído da 09/10 + aluno de progresso parcial) e ≥1 concluído; `assistente_vendas.txt` com ≥1 download — conferido por asserção no e2e e visualmente no print `admin-uso-do-conteudo.png`.
  - [✅] Prints do `/aluno` em 1280px e 390px nos 3 estados (não iniciada, em andamento + baixado, concluída) em `docs/claude-bridge/evidencias/tarefa-10-progresso/`.
  - [✅] `npm run e2e`: **29/29 passos OK** (21 pré-existentes da 05-09 + 8 novos desta tarefa), incluindo os passos de tema da 09 sem alteração de comportamento.
- **Divergências:**
  - **Mecanismo de atualização do `/aluno` ao voltar da aba:** implementei a alternativa "melhor" sugerida (`GET /aluno/progresso.json` + atualização só dos cartões via `visibilitychange`), em vez do `location.reload()`. Justificativa: evita o flash de reload toda vez que o aluno volta da aula, e o endpoint já existia por comodidade de reaproveitar `progressoDoAlunoJson` no render inicial. **Achado ao testar:** o Chromium headless usado pelo Playwright nunca marca uma aba em segundo plano como `document.visibilityState === "hidden"` (todas as páginas ficam "visible" o tempo todo, mesmo com `bringToFront()` explícito) — limitação conhecida de navegadores headless, não um bug do app. Para validar a lógica do próprio `<script>` de `/aluno` sem depender desse comportamento do Chromium, o teste dispara manualmente `document.dispatchEvent(new Event("visibilitychange"))` na aba de `/aluno` (comentado no `e2e.js`). Em um navegador real (com abas de verdade), o evento dispara normalmente ao voltar para a aba.
  - **`express.json({ limit: "1kb" })`:** a tarefa pedia isso "se o JSON ainda não estiver habilitado" — já está (`app.use(express.json())` em `src/server.js`, sem limite explícito, usado também pelo webhook), então não adicionei o limite de 1kb por rota para não introduzir uma exceção de configuração isolada. O corpo aceito por `/aluno/progresso` é validado e minúsculo (`aula`, `passo`, `total`), então o limite padrão do Express (100kb) não é um risco prático aqui.
  - **Rate limit "por sessão":** usei `keyGenerator: (req) => \`progresso:${req.aluno.id}\`` (por aluno autenticado) em vez de por IP, porque a rota já exige sessão antes do rate-limit (`auth.requireAluno` roda primeiro) e várias contas por trás do mesmo IP/CGNAT não deveriam dividir o mesmo teto de 120/min.
  - **Novo aluno de teste no e2e (`ALUNO_PROGRESSO`):** precisei cadastrar um 4º aluno via `/admin` para testar "avança até o passo 3 → volta → continua 3" com uma aula nunca tocada (o `ALUNO_MANUAL` já tinha a Aula 1 concluída pelos testes de tema da 09). Isso empurrou o total de logins reais no e2e para além do rate-limit de 10/min de `/entrar` (proteção de segurança que não devo tocar); resolvi no teste com uma função `entrarComRetentativa()` que tenta de novo com espera se receber 429, em vez de alterar o rate-limit de produção.
- **Achados** (fora do escopo, não corrigidos):
  - Nenhum achado novo de código. Já registrado: favicon/og-image (item 1 do backlog), selo de prazo (baixa prioridade).
- **Commit/branch:** branch `tarefa/10-progresso-aluno`, commit `9b5a24d` (a partir de `main` em `12c0759`, com o commit `0a21761` "docs: planejador — tarefa 10" antes). PR: https://github.com/guilhermepama/t4p-cria/pull/10

