# Tarefa 05 · Preço de lançamento R$ 49,90, garantia, prazo de acesso e limpeza (URGENTE)

**Status: AGUARDANDO EXECUÇÃO**

- **Tipo:** código + texto da landing. ⚠️ Envolve dinheiro (preço exibido × preço cobrado). ⚠️ A landing no ar mostra ao cliente dois avisos de "pendência".
- **Data:** 23/09/2026
- **Base:** decisões do Guilherme em 23/09 (em `t4p-00-estado.md`); registro rápido do `t4p-00-estado.md`

## Decisões de produto (já tomadas, não reabrir)

- **Preço de lançamento: R$ 49,90, só até sexta, 25/09.** **Não** usar preço riscado ("de R$ 99,80"), porque ele nunca foi praticado e o CDC trata isso como propaganda enganosa. A urgência é real: a T4P encerra na sexta.
- **Garantia: 7 dias, reembolso integral.** Texto: "Garantia de 7 dias: se não fizer sentido para você, devolvemos 100% do valor. É só chamar a gente."
- **Acesso à área do aluno: 90 dias, até 24/12/2026.** Os arquivos em PDF e .docx são do aluno para sempre.

## Antes de começar

Crie `tarefa/05-preco-lancamento` a partir da `main` atualizada. O primeiro commit leva só a documentação pendente do planejador: `docs: planejador — tarefa 05`.

## Mecanismo proposto

Valide contra o código. Se houver divergência, reporte.

1. **Uma fonte só para o preço.** Hoje o valor cobrado vem de `PRECO` e o valor exibido na landing está escrito à mão em 6 lugares. Isso não pode divergir.
   - O servidor passa a atender `GET /` lendo `public/index.html` (com cache em memória) e trocando os marcadores `{{preco_brl}}` pelo preço formatado em pt-BR (`49,90`). Os assets continuam no `express.static`, e a rota `/` fica **antes** dele.
   - Na landing, troque todas as ocorrências de preço (os botões "Quero o kit por R$ 97" nas linhas ~551 e ~876, o título "por R$ 97" na ~668, o bloco `.price` na ~801 e as meta descriptions, se tiverem preço) por `{{preco_brl}}`. Confira com `grep -n "97" public/index.html` e não deixe nenhuma sobrar.
   - Mude o padrão de `precoAtual()` para `49.90`. **Nenhuma rota pode cobrar um valor diferente do que foi exibido.**
2. **Formatação:** um único helper `formatarBRL` (ou `precoBRL`) usado em `/comprar`, `/pagamento`, `/admin` e na landing. "R$ 49.90" nunca mais deve aparecer.
3. **Selo de lançamento:**
   - Na oferta (`#oferta`), acima do preço: "Preço de lançamento — só até sexta, 25/09". No hero ou no primeiro CTA, um texto curto equivalente.
   - Em `/comprar`, abaixo do preço: "Preço de lançamento, válido até 25/09".
   - Use o estilo existente (chip/kicker laranja). Sem contador regressivo.
4. **Garantia:** remova o `<span class="pendente">` e o comentário da linha ~811, e coloque no lugar o texto da garantia (decisão acima), no estilo de `.price-note` ou `.btn-note`.
5. **Prazo de acesso:** na FAQ "Por quanto tempo tenho acesso?", troque o `<mark>[DEFINIR DATA…]</mark>` por "24 de dezembro de 2026 (90 dias)". Remova também a regra CSS `.pendente` se nada mais usar.
6. **Aviso no /pagamento/novo** (registro rápido): se o POST for rejeitado porque o PIX ainda é válido, mostre na página "Seu PIX atual ainda está válido. Use o QR abaixo."
7. **Eventos** (registro rápido):
   - A reconsulta do polling **não** grava `mp_ignorado` quando o status é `pending`.
   - Todo evento de `processarPagamento` passa a incluir `origem=webhook` ou `origem=polling` no detalhe.
8. **Aviso de volume** (registro rápido): na inicialização, se o banco acabou de ser criado (arquivo inexistente antes de abrir) e `NODE_ENV=production`, grave `console.warn` bem visível: "Banco novo criado em <DB_PATH>. Se isto aconteceu depois de um redeploy, o volume /app/data NÃO está persistindo." Grave também um evento `db_criado`.
9. **Tabela do /admin** (registro rápido): o e-mail não pode invadir a coluna do WhatsApp. Use `word-break: break-all` ou `overflow-wrap: anywhere` nas células.

## Fora de escopo

- Favicon e og-image (dependem da arte).
- Preço para equipes e WhatsApp real (sem decisão ainda; o `WHATSAPP` continua vazio).
- Mudanças em `conteudo/` e na amostra em PDF.

## Validação

1. `grep -n "97" public/index.html` e `grep -rn "97" src/views/` → nenhum preço antigo.
2. Com `PRECO=49.90`: `GET /` mostra "R$ 49,90" em todos os lugares, `/comprar` mostra "R$ 49,90", e o pedido criado grava `valor = 49.9`. Com `PRECO=12.34`, a landing mostra 12,34. Isso prova que existe uma fonte só.
3. `npm run e2e` passa, com a compra no `mp-fake` aprovada com `transaction_amount = 49.9`. Acrescente ao e2e uma checagem de que o preço mostrado na landing é igual ao cobrado no `mp-fake`.
4. A landing não contém mais "Pendência", "DEFINIR DATA" nem `class="pendente"`.
5. Os eventos de um fluxo de compra com polling: nenhum `mp_ignorado pending`, e o `mp_aprovado` com `origem=`.
6. Subir com um `DB_PATH` novo → o aviso aparece no log e o evento `db_criado` é gravado. Subir de novo com o mesmo arquivo → sem aviso.
7. `/admin` com e-mail de 40 caracteres → sem sobreposição (valide no Playwright com um screenshot anexado ao relatório).
8. `docker build` passa, e o health check fica `healthy`.

## Entrega

- Branch `tarefa/05-preco-lancamento`. **Push liberado para abrir o PR para a `main`.** Sem merge.
- ⚠️ No corpo do PR, escreva em destaque: **"Antes do merge: mudar PRECO para 49.90 no Coolify"** (ou deixar a variável vazia, e aí vale o novo padrão de 49,90).
- Atualize o backlog e o registro rápido em `docs/t4p-00-estado.md`.
- Preencha o relatório e mude o Status.

## Relatório do executor

_(preencher aqui)_
