# Tarefa 04 · Correções de produção: Origin null, proxy, navegador real (URGENTE)

**Status: CONCLUÍDA**

- **Tipo:** correção (hotfix) + testes. ⚠️ Bloqueia a venda: hoje, em produção, **todo POST de formulário** (`/entrar`, `/admin/*`) devolve "Origem inválida".
- **Data:** 23/09/2026
- **Base:** `concluidas/03-checkout-pix.md` (aprovada, ainda sem merge); `t4p-01-especificacao.md` §3 e §5 (revisadas); `t4p-02-deploy-coolify.md` §1 (Cloudflare)

## Antes de começar

1. Crie `tarefa/04-correcoes-producao` **a partir de `tarefa/03-checkout-pix`**, não da `main`. As tarefas 03 e 04 vão juntas num PR só: se a 03 fosse sozinha, publicaria um `/comprar` quebrado pelo mesmo bug.
2. O primeiro commit leva só a documentação pendente do planejador (o arquivamento da 03, a especificação, o `.env.example`, os docs de deploy e o estado): `docs: planejador — tarefa 04`.

## Diagnóstico (já confirmado pelo planejador)

O helmet envia por padrão `Referrer-Policy: no-referrer`. Com essa política, o Chrome manda `Origin: null` nos POSTs de formulário e não manda `Referer`. O `checarOrigem` recebe "null", `new URL("null")` lança erro e a resposta é 403. Os testes das tarefas 02 e 03 não pegaram isso porque usaram curl com `Origin` montado à mão.

## Mecanismo proposto

Valide contra o código e a especificação. Se houver divergência, reporte.

1. **Referrer-Policy:** no `helmet({...})`, `referrerPolicy: { policy: "same-origin" }`.
2. **Proxy:** `app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 2))`. O caminho é Cloudflare → Traefik → app. Remova `SESSION_SECRET` de qualquer referência no código ou nos docs que ainda falem dela (o `.env.example` já foi ajustado).
3. **Testes em navegador real:**
   - Crie `scripts/e2e.js` com o Playwright como **devDependency**. Use o Chromium do sistema se houver, ou `npx playwright install chromium` localmente. Justifique a dependência no relatório. Ela não entra na imagem, porque o `npm ci --omit=dev` e o `.dockerignore` já a deixam de fora.
   - O script sobe o app (com o `mp-fake`) num banco temporário e roda, **clicando nos formulários de verdade**, sem `page.request` e sem cabeçalhos montados à mão:
     - a) `/admin` com `httpCredentials` → cadastra um aluno manual com valor `97,00` (vírgula) → aparece na tabela.
     - b) `/entrar` com esse aluno → vê `/aluno` → abre a Aula 1 → clica "Próxima: Aula 2".
     - c) `/comprar` → preenche e envia → `/pagamento/<token>` mostra o QR → aprova no `mp-fake` → a página navega sozinha até `/aluno`.
     - d) `/sair` funciona.
   - Script `npm run e2e`. Imprime ✅/❌ por passo e sai com código ≠ 0 em qualquer falha.
4. **Valor com vírgula:** `/admin/alunos` aceita `97,00`, `97.00` e `97`. Normalize no servidor, trocando a vírgula por ponto antes do `Number`. No formulário, use `inputmode="decimal"`.
5. **`/comprar` sem credencial:** se `MP_ACCESS_TOKEN` estiver vazio, o GET e o POST de `/comprar` mostram a página "A compra online abre em instantes. Se preferir, fale com a gente e pague por PIX direto." (status 503), sem criar usuário nem pedido. Isso permite fazer o deploy **antes** de ter as credenciais do MP, sem expor um checkout quebrado.
6. **`POST /pagamento/:token/novo`:** só aceite se o pedido estiver `expirado`, ou `pendente` com `expira_em` já vencido. Nos outros casos, redirecione para `/pagamento/:token`.
7. **HEALTHCHECK no Dockerfile**, sem curl: `HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`.
8. **Docs:** marque o item 2 do backlog como mergeado (achado da 03). Os itens 4 e 5 ficam como "feito nas tarefas 03 e 04, aguardando merge".

## Fora de escopo

- Mudanças visuais, de textos da landing ou de preço.
- Separar `server.js` em `routes/` (divergência já aceita).
- Qualquer chamada ao MP real.

## Validação

1. `npm run e2e` → todos os passos de a) a d) ✅. Cole a saída no relatório.
2. O mesmo e2e **rodando na versão da `main` atual** (antes do fix): o passo a) ou b) falha com "Origem inválida". Isso prova que o teste reproduz o bug. Basta registrar a saída, sem commitar nada na `main`.
3. `curl -X POST /entrar -H "Origin: https://evil.com"` → 403 (o CSRF continua ativo).
4. Com `TRUST_PROXY=2`: uma requisição com `X-Forwarded-For: 1.1.1.1, 2.2.2.2` resulta em `req.ip === "1.1.1.1"` (log temporário ou teste unitário). Duas "origens" diferentes não compartilham o limite do rate-limit.
5. Com `MP_ACCESS_TOKEN` vazio, `/comprar` → 503 com a mensagem e **nenhuma** linha nova em `users` ou `orders`.
6. `POST /pagamento/<token>/novo` com o pedido ainda válido → redireciona e não cria pedido.
7. `docker build` + `docker run` → o `docker inspect` mostra `Health: healthy` depois de ~30 s. A imagem não contém `playwright`.

## Entrega

- Branch `tarefa/04-correcoes-producao`. **Push liberado nesta tarefa** para abrir o PR `tarefa/04-correcoes-producao → main` (esse PR inclui os commits da 03). Sem merge.
- No corpo do PR, liste: "inclui tarefa 03 (checkout PIX) + tarefa 04 (hotfix Origin null)".
- Preencha o relatório e mude o Status.

## Relatório do executor

- **Status:** CONCLUÍDA
- **Feito:**
  - `src/server.js`: `app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 2))`; `helmet({ ..., referrerPolicy: { policy: "same-origin" } })` (era o padrão `no-referrer` que fazia o Chrome mandar `Origin: null`); `normalizarValor()` troca vírgula por ponto antes do `Number()` em `POST /admin/alunos`; `checkoutDisponivel()` bloqueia `GET`/`POST /comprar` com 503 (view nova `comprar-indisponivel.html`) quando `MP_ACCESS_TOKEN` está vazio, antes de tocar no banco; `POST /pagamento/:token/novo` só aceita se o pedido estiver `expirado` ou `pendente` com `expira_em` vencido, senão redireciona sem criar nada (achado já registrado no relatório da tarefa 03).
  - `src/views/admin.html`: campo `valor` virou `type="text" inputmode="decimal"` (o `type="number"` rejeitava a vírgula).
  - `src/views/comprar-indisponivel.html` (novo): página da mensagem "A compra online abre em instantes...".
  - `Dockerfile`: `HEALTHCHECK` com `node -e` + `fetch` nativo contra `/health` (sem `curl`, que não está na `node:20-slim`).
  - `.dockerignore`: acrescenta `scripts/e2e.js` (mesmo tratamento do `mp-fake.js`).
  - `scripts/e2e.js` (novo) + `package.json`/`package-lock.json`: `playwright` como devDependency e `npm run e2e`. Sobe o app e o `mp-fake` num banco temporário (`os.tmpdir()`) e clica nos formulários de verdade num Chromium real (tenta o canal `chrome` do sistema, depois `msedge`, depois o Chromium do próprio Playwright — não precisou baixar nada, o Chrome do Windows já estava instalado).
  - `docs/t4p-00-estado.md`: item 2 do backlog marcado como mergeado (era um achado da tarefa 03); itens 4 e 5 como "feito nas tarefas 03 e 04, aguardando merge".
  - `docs/claude-bridge/00-plano-lancamento.md`: removida a menção a `SESSION_SECRET` (nunca foi lida pelo código), trocada por `TRUST_PROXY`.
- **Validação:**
  1. ✅ `npm run e2e` → 4/4 passos ✅ (rodei duas vezes seguidas para descartar instabilidade). Saída:
     ```
     ✅ /admin cadastra aluno manual com valor 97,00 (vírgula)
     ✅ /entrar com o aluno manual → /aluno → Aula 1 → Aula 2
     ✅ /comprar → /pagamento mostra QR → aprovado no mp-fake → cai em /aluno sozinho
     ✅ /sair encerra a sessão e volta para /entrar
     4/4 passos OK
     ```
  2. ✅ Reproduzido isoladamente: subi o `src/server.js` da própria `main` (`git worktree add`, commit `29aa005`) e submeti o formulário de `/admin` num Chromium real. `POST /admin/alunos` → **403 "Origem inválida."** — confirma que o bug já existe na `main` (não é algo introduzido pela tarefa 03) e que um teste em navegador real o pega. Depois de aplicar o fix desta tarefa, o mesmo fluxo (dentro do `npm run e2e`) passa. Não commitei nada na `main`; usei uma worktree temporária, removida ao final (`git worktree remove`).
  3. ✅ `curl -X POST /entrar -H "Origin: https://evil.com" -d "..."` → `403`. O CSRF continua ativo (não ficou "aberto" ao consertar o Origin null).
  4. ✅ Com `TRUST_PROXY=2` (também o padrão, sem a variável), uma requisição com `X-Forwarded-For: 1.1.1.1, 2.2.2.2` resulta em `req.ip === "1.1.1.1"` (`req.ips === ["1.1.1.1","2.2.2.2"]`), testado com uma instância mínima do Express isolada (mesma linha `app.set("trust proxy", ...)` do `server.js`). Como o rate-limit usa `req.ip` como chave, duas origens diferentes (duas cadeias de X-Forwarded-For distintas) caem em buckets diferentes — é consequência direta do `trust proxy` estar correto, não precisou de um teste à parte.
  5. ✅ Com `MP_ACCESS_TOKEN` vazio: `GET /comprar` → 503 com a mensagem amigável; `POST /comprar` (com nome/e-mail/whatsapp/senha/aceite válidos) → 503, mesma mensagem. Consultei o SQLite depois: `users: 0`, `orders: 0` — nenhuma linha criada.
  6. ✅ `POST /pagamento/<token>/novo` com o pedido ainda `pendente` e não vencido → `303` de volta para `/pagamento/<token>` (mesmo token); no banco, continua havendo só 1 pedido, `status = 'pendente'`. Nenhum pedido novo foi criado.
  7. ✅ `docker build` + `docker run` (porta 3460, `ADMIN_USER`/`ADMIN_PASS` de teste) → depois de ~35s, `docker inspect` mostra `"Status":"healthy"`. Confirmado com `docker run ... ls /app/scripts` que a imagem só tem `criar-aluno.js` (nem `mp-fake.js` nem `e2e.js`), e que `node_modules` não tem `playwright` nem `curl` no sistema de arquivos da imagem.
- **Divergências:**
  - A Aula 1 (`conteudo/Aula1_O_Pedido_que_Funciona.html`) é uma lição interativa de uma página só, com 6 passos travados (`data-trava`) que só liberam o botão "Continuar" depois de uma pequena interação (responder o quiz, tocar nos 4 ingredientes do método CAFÉ, etc.) — o cartão "Próxima: Aula 2" só aparece no último passo. A tarefa descrevia só "abre a Aula 1 → clica 'Próxima: Aula 2'", sem prever essa mecânica. Resolvi fazendo o `e2e.js` percorrer os 6 passos com cliques reais nos controles de cada exercício (não usei `page.evaluate` nem chamei funções JS diretamente — são cliques de verdade, só que na sequência certa), e usei `reducedMotion: "reduce"` no contexto do Playwright para pular as animações de digitação/transição (isso não muda o que precisa ser clicado, só a velocidade). Não editei o arquivo em `conteudo/`, que é cópia de `03_Produto_Aula_Digital/`.
  - Para aprovar o PIX no passo c) do e2e, chamei o `POST /__set/:id` do `mp-fake` diretamente com `fetch` (fora do navegador). Interpretei a instrução "sem `page.request`" como sendo sobre as interações com o **nosso** app (que devem ser cliques de verdade), não sobre o `mp-fake`: não existe formulário no nosso sistema para simular "o banco aprovou o PIX", isso é o papel do Mercado Pago de verdade: o `mp-fake` faz esse papel também fora do navegador.
  - Os itens 3 a 7 da validação não entraram no `npm run e2e`: usei um `curl` (item 3, que a própria tarefa pede) e três scripts descartáveis no `scratchpad` (items 2, 4 e 5/6 combinados) e o Docker CLI direto (item 7). Não commitei esses scripts avulsos — são só evidência para este relatório.
  - No commit `1b1d089` ("fix: /admin/alunos aceita valor com vírgula"), acabei incluindo no mesmo `git add src/server.js` as mudanças do `checkoutDisponivel()` e da guarda do `/pagamento/:token/novo` (que documentei corretamente no commit seguinte, `63166a9`, mas cujo código já estava fisicamente ali). Não refiz o histórico porque nada foi perdido nem descrito errado — só o corte entre os dois commits ficou menos limpo do que pretendia.
  - No backlog (`docs/t4p-00-estado.md`), a tarefa pedia que os itens 4 **e** 5 ficassem com o texto "feito nas tarefas 03 e 04, aguardando merge". O item 5 sempre foi só "(fundido no item 4)" (mesmo padrão do item 3 → item 2); mantive essa marcação e acrescentei o texto pedido ao lado, em vez de duplicar a frase inteira no lugar da marcação de fusão.
- **Achados** (fora do escopo, não corrigidos):
  - Quando `POST /pagamento/:token/novo` é rejeitado (pedido ainda válido) e redireciona de volta para `/pagamento/:token`, a página não mostra nenhum aviso explicando por que nada mudou (ela só reaparece igual). Baixo impacto — só acontece se o aluno reenviar o formulário de "Gerar novo PIX" antes de ele realmente expirar (ex.: voltar no navegador) — e a tarefa não pediu mensagem nesse caso.
  - `docker build` imprime "npm notice: New major version of npm available (10.8.2 -> 12.1.0)"; não é erro, só um lembrete do próprio npm, sem relação com esta tarefa.
- **Commit/branch:** branch `tarefa/04-correcoes-producao`, criada a partir da `tarefa/03-checkout-pix` (que ainda não tinha sido mergeada). Commits: `9f1cd39` (docs pendentes do planejador), `4e071b2` (Referrer-Policy + trust proxy + limpeza do `SESSION_SECRET`), `1b1d089` (valor com vírgula — ver divergência acima), `63166a9` (`/comprar` indisponível + guarda do `/pagamento/:token/novo`), `7f11af8` (HEALTHCHECK), `1909795` (`scripts/e2e.js` + Playwright), `9a8c8be` (backlog). Fiz o push da branch e abri o PR `tarefa/04-correcoes-producao → main` (inclui os commits da tarefa 03). Sem merge.
