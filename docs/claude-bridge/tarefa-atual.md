# Tarefa 03 · Checkout PIX, webhook e /privacidade (backlog 4)

**Status: CONCLUÍDA**

- **Tipo:** código. ⚠️ Envolve dinheiro. ⚠️ Tem migração de schema (a coluna nova precisa funcionar num banco que já existe em produção).
- **Data:** 23/09/2026
- **Base:** `concluidas/02-aluno-admin.md`; `t4p-01-especificacao.md` §2, §3, §4 e §5 (revisadas em 23/09: sem `notification_url`, `MP_API_URL`, `login_feito`, CSV contra fórmula); `t4p-00-estado.md`

## Antes de começar

1. Confira se o PR #2 (`tarefa/02-aluno-admin`) já foi mergeado na `main`. Se não foi, reporte como **BLOQUEADA**.
2. Crie `tarefa/03-checkout-pix` a partir da `main` atualizada. O primeiro commit leva só a documentação pendente do planejador: `docs: planejador — tarefa 03`.

## Objetivo

Ligar a venda automática. O visitante clica em comprar, se cadastra e recebe o QR do PIX. Quando paga, o acesso é liberado sozinho (pelo webhook ou, se ele falhar, pela reconsulta) e ele cai logado na área do aluno. Não há credencial do Mercado Pago no ambiente do executor, então **toda a validação usa um servidor falso do MP**. O teste com dinheiro de verdade é do Guilherme, depois do merge.

## Mecanismo proposto

Valide contra o código e a especificação. Se houver divergência, reporte.

1. **Migração (`db.js`):** depois dos `CREATE IF NOT EXISTS`, leia `PRAGMA table_info(orders)` e, se a coluna `login_feito` não existir, rode `ALTER TABLE orders ADD COLUMN login_feito INTEGER NOT NULL DEFAULT 0`. A migração precisa ser idempotente e rodar em qualquer banco já existente. Faça o mesmo para qualquer outra coluna que a especificação cite e o banco ainda não tenha.

2. **`src/mp.js`:**
   - URL base: `MP_API_URL`, com padrão `https://api.mercadopago.com`. Toda chamada usa `fetch` com timeout de 10 s (`AbortSignal.timeout`).
   - `criarPix({pedido, usuario})`: `POST /v1/payments` conforme a §4, **sem** `notification_url`.
     - `X-Idempotency-Key: T4P-<pedido.token>` e `external_reference: "T4P-<pedido.id>"`.
     - `date_of_expiration` com +30 min, no formato `YYYY-MM-DDTHH:mm:ss.SSS-03:00`.
   - `consultarPagamento(id)`: `GET /v1/payments/{id}`.
   - `validarAssinatura({xSignature, xRequestId, dataId})`: manifesto e HMAC conforme a §4, com `timingSafeEqual`. Se `MP_WEBHOOK_SECRET` estiver vazio, sempre devolve `false`.
   - Nenhum token ou segredo vai para log.

3. **`processarPagamento(paymentId)`:** uma função única, usada pelo webhook e pela reconsulta.
   - Busca o pagamento, localiza o pedido por `external_reference` (`T4P-<id>`) e confere se `mp_payment_id` bate.
   - `approved` com `transaction_amount >= pedido.valor` → numa transação, o pedido vira `pago` (`pago_em`) e o usuário vira `ativo = 1`. É idempotente.
   - `refunded` ou `charged_back` → o pedido vira `estornado` e o usuário, `ativo = 0`, **desde que ele não tenha outro pedido `pago` ou `manual`**.
   - `cancelled`, `rejected` ou pagamento expirado → o pedido vira `expirado`.
   - Todo caminho grava um registro em `eventos` (`mp_aprovado`, `mp_estorno`, `mp_ignorado`, `mp_erro`, com o motivo).

4. **`GET /comprar`:** formulário no visual das outras views. Campos: nome, e-mail, WhatsApp (obrigatório, só dígitos, 10 ou 11 dígitos depois de limpar), senha (mínimo 8) e o checkbox "Li e aceito a política de privacidade", com link para `/privacidade`. O preço vem de `PRECO`.

5. **`POST /comprar`:** `checarOrigem`, rate-limit de 10 por minuto por IP, validação no servidor.
   - E-mail de usuário **ativo** → mensagem "Você já tem acesso", com link para `/entrar` (status 409).
   - E-mail de usuário **inativo** → atualiza nome, WhatsApp e senha. Se ele já tiver um pedido `pendente` que ainda não expirou, reaproveita esse pedido. Senão, cria um novo.
   - Pedido novo: gera o `token` (16 bytes em hex), grava o pedido, chama `criarPix` e grava `mp_payment_id`, QR, copia-e-cola e `expira_em`.
   - Se o MP falhar → evento `mp_erro` e a página mostra "Não conseguimos gerar o PIX agora. Tente de novo em instantes." O pedido fica `pendente` sem QR, e o próximo envio cria outro.
   - Sucesso → 303 para `/pagamento/<token>`.

6. **`GET /pagamento/:token`:** mostra o QR (`<img src="data:image/png;base64,...">`), o copia-e-cola com botão Copiar, o valor, a contagem regressiva até `expira_em` e o aviso "Assim que o pagamento cair, você entra automaticamente".
   - O JS consulta `/api/pedido/:token` a cada 3 s.
   - `pago` → navega para `/pagamento/:token/acesso`.
   - `expirado` (ou contador zerado) → mostra o botão "Gerar novo PIX", que faz `POST /pagamento/:token/novo` (com `checarOrigem`) e cria um pedido novo para o mesmo usuário.
   - Token inexistente → 404.

7. **`GET /api/pedido/:token`:** devolve `{status}`. Se o pedido estiver `pendente`, tiver `mp_payment_id` e a última consulta tiver sido há mais de 5 s (controle em memória por pedido), chama `processarPagamento` antes de responder. Se estiver pendente e `expira_em` já passou → marca `expirado`.

8. **`GET /pagamento/:token/acesso`:** se o pedido estiver `pago`, com `login_feito = 0` e `pago_em` de menos de 2 h → marca `login_feito = 1`, cria a sessão e redireciona para `/aluno`. Em qualquer outro caso → `/entrar`.

9. **`POST /webhooks/mp`:**
   - Sem `checarOrigem` e sem rate-limit.
   - Pega `data.id` da query ou do corpo (`body.data.id`), e o `type` ou `topic`.
   - Tipo diferente de `payment` → evento `mp_ignorado` e 200.
   - Assinatura inválida → evento `webhook_assinatura_invalida` e 401.
   - Assinatura válida → responde 200 **na hora** e roda `processarPagamento` em seguida (`setImmediate`, com try/catch que grava `mp_erro`).

10. **`GET /privacidade`:** uma página curta. Dados coletados (nome, e-mail, WhatsApp e dados do pagamento, estes processados pelo Mercado Pago), para que servem (liberar e manter o acesso, suporte), que não são vendidos nem compartilhados, retenção pelo período de acesso ao kit, e o pedido de exclusão feito pelo contato. Responsável: T4P – Tech for People (Olímpia/SP), contato guilhermepama1@gmail.com. Também um link "Privacidade" no rodapé de `/comprar` e de `/entrar`.

11. **Landing (`public/index.html`):** preencher `const LINK_COMPRA = "/comprar";`. Não alterar mais nada nesse arquivo.

12. **CSV do admin:** proteger contra fórmula (§5). No /admin, o status `pendente` aparece com o `expira_em`, e as ações "Ativar" e "Nova senha" continuam funcionando.

13. **`scripts/mp-fake.js`:** um servidor HTTP local que imita `POST /v1/payments` (devolve id, QR base64 de uma imagem 1×1 e copia-e-cola) e `GET /v1/payments/:id`. O status pode ser controlado por `POST /__set/:id` (`{status, transaction_amount}`). Também tem um helper para assinar o webhook com um segredo de teste. **Não faz parte da imagem Docker:** acrescentar ao `.dockerignore` ou manter fora da cópia.

## Fora de escopo

- Qualquer chamada ao MP real e qualquer credencial real.
- Remover os avisos âmbar da landing (dependem das decisões de garantia e prazo).
- Favicon e og-image.
- E-mail transacional e reembolso iniciado pelo app.

## Validação

Todos os itens rodam com o app apontado para o `mp-fake`, via `MP_API_URL=http://localhost:<porta>`.

1. **Migração:** um banco criado pela versão da `main` (sem `login_feito`) sobe sem erro e ganha a coluna. Subir de novo não dá erro.
2. `/comprar` → envio → 303 para `/pagamento/<token>`, que mostra o QR e o copia-e-cola. O `mp-fake` recebeu `X-Idempotency-Key` e `external_reference` corretos, e **não** recebeu `notification_url`.
3. **Webhook assinado** com o pagamento aprovado → 200. Pedido `pago`, usuário ativo, evento `mp_aprovado`. `/api/pedido/<token>` → `pago`.
4. **Sem webhook:** aprovar no fake e só consultar `/api/pedido` → vira `pago` pela reconsulta.
5. `/pagamento/<token>/acesso` → na primeira vez, cria a sessão e vai para `/aluno` (200 com as aulas). Na segunda, vai para `/entrar`.
6. Webhook com assinatura errada → 401 e evento registrado, sem ativar nada. Webhook com `type` diferente de `payment` → 200 e ignorado.
7. Aprovado com valor menor que o do pedido → **não** ativa (evento com o motivo). `external_reference` de outro pedido → não ativa.
8. Webhook repetido 3 vezes para o mesmo pagamento → um único `pago`, sem duplicar nada.
9. Estorno no fake + webhook → pedido `estornado` e usuário inativo. `/aluno` redireciona para `/entrar`.
10. Pedido expirado → o botão "Gerar novo PIX" cria outro pedido para o mesmo usuário, e o pedido antigo fica `expirado`.
11. E-mail já ativo em `/comprar` → 409 com o link para `/entrar`. E-mail inativo com pendente válido → reaproveita o pedido (não chama o fake de novo).
12. POST em `/comprar` com `Origin` de fora → 403. `/webhooks/mp` sem `Origin` → aceito, desde que a assinatura seja válida.
13. `mp-fake` desligado → `/comprar` mostra a mensagem de erro amigável, e o evento `mp_erro` é registrado.
14. CSV: um aluno cadastrado com nome `=1+1` sai como `'=1+1`.
15. `/privacidade` → 200. O botão de compra da landing leva a `/comprar`.
16. `grep -rn "APP_USR\|MP_ACCESS_TOKEN=" --include=*.js .` sem nenhum valor real. `docker build` passa e a imagem não contém `scripts/mp-fake.js`.

## Entrega

- Branch `tarefa/03-checkout-pix`, com commits pequenos. **Sem push e sem merge.**
- Atualize o item 4 do backlog em `docs/t4p-00-estado.md`.
- No relatório, inclua uma seção **"Roteiro do teste real"**: 5 a 8 passos para o Guilherme validar com R$ 1 em produção, com o que ver no /admin em cada passo.
- Preencha o relatório e mude o Status.

## Relatório do executor

- **Status:** CONCLUÍDA
- **Feito:**
  - `src/db.js`: migração idempotente (`PRAGMA table_info(orders)` + `ALTER TABLE ... ADD COLUMN login_feito`), queries de checkout/PIX (`criarUsuarioInativo`, `atualizarUsuarioParaCompra`, `buscarPedidoPorToken`, `buscarPedidoPorId`, `buscarPedidoPendenteValido`, `criarPedido`, `atualizarPedidoPix`, `marcarLoginFeito`, `marcarPedidoExpirado`, `marcarPedidoPago` e `marcarPedidoEstornado`, estas duas últimas em transação e idempotentes), e `expira_em` incluído em `listarAlunosComPedidos`.
  - `src/mp.js` (novo): `criarPix` (`POST /v1/payments`, sem `notification_url`, `X-Idempotency-Key: T4P-<token>`, `date_of_expiration` com offset `-03:00` fixo calculado sem depender do fuso do servidor), `consultarPagamento` (`GET /v1/payments/:id`) e `validarAssinatura` (manifesto + HMAC-SHA256 + `timingSafeEqual`, `false` se `MP_WEBHOOK_SECRET` vazio). Todas as chamadas usam `MP_API_URL` (padrão `https://api.mercadopago.com`) e timeout de 10s via `AbortSignal.timeout`. Nenhum segredo é logado.
  - `src/server.js`: `processarPagamento(paymentId)` (função única usada pelo webhook e pela reconsulta, idempotente, grava eventos `mp_aprovado`/`mp_estorno`/`mp_ignorado`/`mp_erro`); rotas `GET/POST /comprar`, `GET /pagamento/:token`, `POST /pagamento/:token/novo`, `GET /api/pedido/:token` (throttle de 5s por pedido via `Map` em memória), `GET /pagamento/:token/acesso` (login único, janela de 2h), `POST /webhooks/mp` (sem `checarOrigem`/rate-limit, responde 200 antes de processar via `setImmediate`), `GET /privacidade`. `/admin`: status `pendente` agora mostra `expira_em`; CSV protegido contra fórmula (`protegerCsv` em nome/e-mail/WhatsApp).
  - Views novas: `comprar.html`, `pagamento.html` (QR, copia-e-cola com botão copiar, contador regressivo e polling a cada 3s, tudo no visual escuro/laranja das outras telas) e `privacidade.html`. `entrar.html` ganhou o rodapé com link "Privacidade".
  - `scripts/mp-fake.js` (novo): servidor HTTP puro (sem dependência nova) simulando `POST /v1/payments`, `GET /v1/payments/:id`, `POST /__set/:id` para forçar status, e `assinarWebhook()` exportado como helper de assinatura para os testes manuais. Adicionado a `.dockerignore`.
  - `.env.example`: variável `MP_API_URL` documentada.
  - `public/index.html`: `LINK_COMPRA = "/comprar"` (única linha alterada).
  - `docs/t4p-00-estado.md`: item 4 do backlog marcado como feito/aguardando merge.
- **Validação** (app apontado para `scripts/mp-fake.js` via `MP_API_URL=http://localhost:3333`):
  1. ✅ Banco criado com o schema anterior (sem `login_feito`) sobe com a versão nova sem erro e ganha a coluna; subir de novo não dá erro (testado com script isolado simulando o schema pré-tarefa).
  2. ✅ `/comprar` → 303 para `/pagamento/<token>` com QR e copia-e-cola. Confirmado via servidor-espelho que o corpo enviado ao MP tem `X-Idempotency-Key: T4P-<token>`, `external_reference: T4P-<id>` e **não** tem `notification_url`.
  3. ✅ Webhook assinado com pagamento `approved` → 200; pedido `pago`, usuário `ativo=1`, evento `mp_aprovado`; `/api/pedido/<token>` → `{status:"pago"}`.
  4. ✅ Sem chamar o webhook: aprovar no fake e só consultar `/api/pedido/<token>` → pedido vira `pago` pela reconsulta.
  5. ✅ `/pagamento/<token>/acesso` na primeira vez cria a sessão e leva a `/aluno` (nome do aluno aparece); na segunda vez leva a `/entrar`.
  6. ✅ Assinatura errada → 401 + evento `webhook_assinatura_invalida`, nada é ativado; `type` diferente de `payment` → 200 + evento `mp_ignorado`.
  7. ✅ `transaction_amount` menor que o pedido → evento `mp_ignorado` com o motivo, pedido continua `pendente`; pagamento cujo `mp_payment_id` não bate com o do pedido correspondente ao `external_reference` → evento `mp_ignorado`, nada ativado.
  8. ✅ Webhook reenviado 3× para o mesmo `data.id` → único `pago`, `pago_em` não muda entre as tentativas.
  9. ✅ Estorno (`refunded`) + webhook → pedido `estornado`, usuário `ativo=0` (sem outro pedido `pago`/`manual`); `/pagamento/<token>/acesso` e depois `/aluno` mandam para `/entrar`.
  10. ✅ Pedido com `expira_em` no passado: `/api/pedido` marca `expirado`; `POST /pagamento/<token>/novo` cria um pedido novo (novo `token`, novo `mp_payment_id`) para o mesmo usuário e marca o antigo como `expirado`.
  11. ✅ E-mail já ativo em `/comprar` → 409 com link para `/entrar`. E-mail inativo com pedido pendente ainda válido → reaproveita o mesmo token e **não** chama o `mp-fake` de novo (confirmado checando que nenhum pagamento novo foi criado no fake); nome/WhatsApp/senha do usuário são atualizados.
  12. ✅ `POST /comprar` com `Origin: https://evil.com` → 403. `POST /webhooks/mp` sem `Origin`, com assinatura válida → 200 (aceito).
  13. ✅ Com o `mp-fake` desligado, `/comprar` responde com a mensagem amigável e grava evento `mp_erro`; o pedido fica `pendente` sem QR e não é reaproveitado na tentativa seguinte.
  14. ✅ Aluno cadastrado via `/admin/alunos` com nome `=1+1` sai no CSV como `'=1+1`.
  15. ✅ `/privacidade` → 200. `LINK_COMPRA` da landing aponta para `/comprar`.
  16. ✅ `grep -rn "APP_USR\|MP_ACCESS_TOKEN=" --include=*.js .` sem resultado. `docker build` concluído com sucesso; `docker run ... ls /app/scripts` confirma que `mp-fake.js` **não** está na imagem (só `criar-aluno.js`). Também rodei `npm audit --omit=dev` → 0 vulnerabilidades (sem dependência nova).
- **Divergências:**
  - A tabela de rotas da §3 da especificação ainda lista `POST /api/checkout`, `GET /pagamento/:id` e `GET /api/pedido/:id`, e não lista `/pagamento/:token/acesso` nem `/pagamento/:token/novo`. Segui o mecanismo desta tarefa (mais detalhado e mais recente, e consistente com a prosa da própria §3 sobre `login_feito` e com a §4 sobre `notification_url`/`MP_API_URL`), implementando tudo dentro de `POST /comprar` em vez de um `/api/checkout` separado, com `:token` no lugar de `:id`. Registro para o planejador atualizar a tabela, não bloqueei por ser uma divergência de nomenclatura/estrutura de rota, não uma decisão de produto.
  - Mantive tudo em `src/server.js`, sem criar `src/routes/*.js` como a §1 da especificação sugere — mesma divergência já registrada (e aceita) no relatório da tarefa 02, por consistência com o padrão já emplacado no código.
  - `POST /pagamento/:token/novo` não confere no servidor se o pedido antigo já expirou de fato antes de aceitar o pedido (a tarefa só descreve o botão aparecendo quando expirado no front); um aluno poderia forçar um PIX novo um pouco mais cedo. Risco baixo (cria só um pedido extra pendente para ele mesmo) e não há checagem equivalente pedida na especificação, então não adicionei.
- **Achados** (fora do escopo, não corrigidos):
  - O item 2 do backlog em `docs/t4p-00-estado.md` ainda diz "aguardando merge", mas o PR #2 já está mergeado na `main` (confirmado antes de começar esta tarefa). Não corrigi por a instrução pedir só a atualização do item 4.
  - `SESSION_SECRET` está documentada no `.env.example` desde a tarefa 01/02 mas nunca é lida pelo código (as sessões usam token aleatório por sessão, não uma chave fixa). Não é usada por esta tarefa; registro para limpeza futura.

### Roteiro do teste real (R$ 1, produção)

1. No Coolify, configurar `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` da aplicação **"T4P"** real (nunca a do Orbinote), deixar `MP_API_URL` vazio (usa o padrão do MP) e `PRECO=1.00` só para este teste. No painel do Mercado Pago da app T4P, apontar o webhook para `https://iadojeitocerto.com/webhooks/mp` com o mesmo segredo. Fazer o deploy da `main` após o merge desta tarefa.
2. Abrir `https://iadojeitocerto.com/comprar` num navegador limpo (ou aba anônima) e gerar o PIX com um e-mail seu. **No /admin:** deve aparecer uma linha nova com status "pendente (expira às ...)".
3. Pagar o PIX de R$ 1 de verdade, pelo app do seu banco.
4. Esperar a página navegar sozinha para a área do aluno (pode levar até uns segundos, pelo polling). **No /admin:** o pedido deve virar "pago", "Pedidos pagos + manuais" e "Total em vendas" sobem em R$ 1, e aparece o evento `mp_aprovado` na lista de últimos eventos com o horário do pagamento.
5. Clicar em "Sair" e tentar reabrir o mesmo link de pagamento (`/pagamento/<token>/acesso`, se você tiver salvo) — deve mandar para `/entrar` em vez de logar de novo sozinho.
6. Baixar `/admin/vendas.csv` e abrir no Excel: confirmar que abre com os acentos certos e que a linha do teste mostra R$ 1,00 e o status "pago".
7. (Opcional, para testar o fallback) Colocar o celular em modo avião por uns 10 segundos logo depois de pagar, tirar do modo avião e conferir que o pedido ainda vira "pago" sozinho (via reconsulta) mesmo que o webhook tenha atrasado; confirmar no /admin que não duplicou nada.
8. Depois de validar, voltar `PRECO` para `97.00` no Coolify, reiniciar o app e só então anunciar a venda de verdade.

- **Commit/branch:** branch `tarefa/03-checkout-pix`, criada a partir da `main` pós-merge da tarefa 02 (`29aa005`). Commits: `bed4e7d` (docs do planejador), `745cf9c` (migração + queries de pedido no `db.js`), `b338419` (`src/mp.js`), `8ef113e` (views de comprar/pagamento/privacidade), `47b5d37` (rotas em `server.js`), `96b2f4d` (`mp-fake.js` + `.dockerignore`), `697eb99` (`.env.example`, `LINK_COMPRA`, backlog). Sem push, sem merge.
