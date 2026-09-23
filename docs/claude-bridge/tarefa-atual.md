# Tarefa 03 · Checkout PIX, webhook e /privacidade (backlog 4)

**Status: AGUARDANDO EXECUÇÃO**

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

_(preencher aqui)_
