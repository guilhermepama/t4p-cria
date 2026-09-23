# Tarefa 04 · Correções de produção: Origin null, proxy, navegador real (URGENTE)

**Status: AGUARDANDO EXECUÇÃO**

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

_(preencher aqui)_
