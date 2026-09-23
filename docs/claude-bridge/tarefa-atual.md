# Tarefa 05 · Preço de lançamento R$ 49,90, garantia, prazo de acesso e limpeza (URGENTE)

**Status: CONCLUÍDA**

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

- **Status:** CONCLUÍDA
- **Feito:**
  - `src/server.js`: `precoAtual()` default vira `49.90`; novo `precoBRL(valor)` (formata em pt-BR com vírgula, sem símbolo) e `formatarBRL(valor)` reescrito sobre ele (`"R$ " + precoBRL(valor)`) — uma fonte única para todo número exibido. `GET /` e `GET /index.html` passam a ler `public/index.html` uma vez no boot (cache em memória em `INDEX_TEMPLATE`) e trocar `{{preco_brl}}` por `precoBRL(precoAtual())`; a rota fica antes do `express.static`. `/comprar` (GET e os 3 pontos de reexibição do POST) usa `precoBRL(precoAtual())` em vez de `precoAtual().toFixed(2)` (corrige o achado "R$ 97.00" com ponto). `/admin` (form de cadastro manual), `/admin/alunos` e `/admin/ativar/:userId` trocam `process.env.PRECO` direto por `precoAtual()`. `POST /pagamento/:token/novo` rejeitado (PIX ainda válido) redireciona com `?aviso=valido`; `GET /pagamento/:token` monta `avisoHtml` para esse caso. `processarPagamento(paymentId, origem)` ganhou o parâmetro `origem` (`"webhook"` ou `"polling"`, gravado em todo `registrarEvento` da função) e passa a sair sem gravar evento quando o status reconsultado ainda é `"pending"` (mantém o registro quando `pending` mas já expirado, que ainda vira `mp_ignorado` com a transição para `expirado`).
  - `public/index.html`: as 6 ocorrências de preço (2 meta tags, 2 CTAs, o título "por R$ 97" e o `.price`) viram `{{preco_brl}}`. Selo `<span class="hero-tag selo-lancamento">Preço de lançamento — só até sexta, 25/09</span>` no hero (`.hero-cta`) e na oferta (`#oferta`, acima do preço) — reaproveita o `.hero-tag` que já existia, só com uma classe modificadora (`.selo-lancamento{margin-bottom:18px}`) para o espaçamento nesses dois lugares. `<span class="pendente">` e o comentário de pendência da garantia saíram; no lugar, `<p class="btn-note">Garantia de 7 dias: se não fizer sentido para você, devolvemos 100% do valor. É só chamar a gente.</p>`. A regra CSS `.pendente` foi removida (nada mais a usa). FAQ "Por quanto tempo tenho acesso?": o `<mark>[DEFINIR DATA...]</mark>` virou `<strong>24 de dezembro de 2026 (90 dias)</strong>`.
  - `src/views/comprar.html`: `<p class="selo">Preço de lançamento, válido até 25/09</p>` abaixo do preço (nova classe `.selo`, no mesmo laranja do `.preco`).
  - `src/views/pagamento.html`: novo `{{{avisoHtml}}}` (reaproveita a classe `.aviso` já existente) para o caso do PIX ainda válido.
  - `src/views/admin.html`: `overflow-wrap: anywhere` só em `td:nth-child(1), td:nth-child(2), td:nth-child(3)` (Nome, E-mail, WhatsApp) — não em `th,td` genérico, porque isso é herdado pelos botões da coluna Ações e quebra "Nova senha" letra a letra (peguei essa regressão no próprio teste, ver Achados).
  - `src/db.js`: `dbJaExistia = fs.existsSync(DB_PATH)` antes de abrir a conexão. Se o banco acabou de ser criado: grava sempre o evento `db_criado` (com `DB_PATH` no detalhe); o `console.warn` só imprime com `NODE_ENV=production` (ver Divergências — a tarefa lia como se as duas coisas dependessem da produção, separei porque um evento em log de auditoria não tem por que ficar escondido em dev/teste).
  - `.env.example`: `PRECO=49.90`, comentário atualizado para "preço de lançamento".
  - `scripts/e2e.js`: `PRECO`/`PRECO_BRL`/`PRECO_NUM` viram constantes (`"49.90"` / `"49,90"` / `49.9`) usadas tanto no env do processo filho quanto nas asserções — é a mesma variável dos dois lados, não dois números coincidentes. Passo novo no início: `GET /` e `GET /comprar` mostram o preço e não sobra `{{preco_brl}}` nem "R$ 97". No fluxo de compra por PIX, depois de aprovar no `mp-fake`, confere `GET /v1/payments/1000` (pedido 1000 é o único criado no teste) e compara `transaction_amount` com `PRECO_NUM` — é a prova pedida na validação 3 de que o preço mostrado é o preço cobrado. Passo novo: cadastra um aluno com e-mail de 58 caracteres em `/admin`, confere `scrollWidth <= clientWidth` na célula do e-mail (mais confiável que comparar `boundingBox` — com `table-layout:fixed` a largura da célula não muda com o conteúdo, só o conteúdo transborda visualmente) e salva um screenshot em `docs/claude-bridge/evidencias/tarefa-05-admin-email-longo.png`. Passo novo depois da compra: `/admin` não tem `mp_ignorado ... status=pending` e tem `mp_aprovado ... origem=polling`.
  - `docs/t4p-00-estado.md`: item 6 do backlog marcado como feito; removidos da "Pendências de produto" a garantia e o prazo de acesso (já decididos); removidos os 5 itens do registro rápido resolvidos nesta tarefa.
- **Validação:**
  1. ✅ `grep -n "97" public/index.html` e `grep -rn "97" src/views/` → sem nenhuma ocorrência (comandos rodados depois de cada edição, e de novo no fim).
  2. ✅ Com `PRECO=49.90`: subi o servidor num banco temporário e conferi por `curl` — `GET /` mostra "R$ 49,90" nas 6 ocorrências (incluindo as meta tags), `/comprar` mostra "R$ 49,90" (antes do fix mostrava "R$ 97.00", com ponto), pedido criado no `/comprar → /pagamento` grava `valor = 49.9` no banco (conferido pelo `e2e`, que também aprova o pagamento e checa o `transaction_amount`). Repeti tudo com `PRECO=12.34`: a landing e o `/comprar` mostraram "R$ 12,34" nos mesmos lugares — prova que existe uma única fonte (screenshots não salvos, foi checagem por `curl`/`grep`, descartável).
  3. ✅ `npm run e2e` → 7/7 passos (os 4 originais + os 3 novos desta tarefa). Saída:
     ```
     ✅ GET / e /comprar mostram o preço de lançamento (R$ 49,90)
     ✅ /admin cadastra aluno manual com valor 49,90 (vírgula)
     ✅ /admin: e-mail de 40+ caracteres não invade a coluna do WhatsApp
     ✅ /entrar com o aluno manual → /aluno → Aula 1 → Aula 2
     ✅ /comprar → /pagamento mostra QR → aprovado no mp-fake → cai em /aluno sozinho
     ✅ /sair encerra a sessão e volta para /entrar
     ✅ eventos: sem mp_ignorado pending repetido, e mp_aprovado registra origem=
     7/7 passos OK
     ```
     A compra no `mp-fake` foi aprovada com `transaction_amount = 49.9` (o `e2e` falha se não bater com o preço mostrado na landing/comprar).
  4. ✅ `grep -n "pendente\|DEFINIR DATA\|Pendência" public/index.html` → sem nenhuma ocorrência.
  5. ✅ Verificado pelo passo novo do `e2e` (item 3 acima): depois de um fluxo de compra com polling (o `mp-fake` não manda webhook, só a reconsulta do `/api/pedido/:token` processa o pagamento), `/admin` não tem nenhum `mp_ignorado` com `status=pending`, e o `mp_aprovado` tem `origem=polling` no detalhe.
  6. ✅ `DB_PATH` novo, `NODE_ENV=production`, via `node -e "require('./src/db')"`: imprime `Banco novo criado em <caminho>. Se isto aconteceu depois de um redeploy, o volume /app/data NÃO está persistindo.` Rodando de novo com o mesmo arquivo: nenhuma saída. Evento `db_criado` conferido direto no banco (`db.listarEventosRecentes`) — gravado mesmo sem `NODE_ENV=production` (ver Divergências).
  7. ✅ Passo novo do `e2e` (item 3 acima) cadastra um aluno com e-mail de 58 caracteres, confere `scrollWidth <= clientWidth` na célula e salva `docs/claude-bridge/evidencias/tarefa-05-admin-email-longo.png` (anexado ao commit `test: scripts/e2e.js ...`). Antes do fix da coluna Ações (ver Achados), o mesmo teste tirou um screenshot com o botão "Nova senha" quebrando letra a letra — comparei os dois manualmente para confirmar que o fix resolveu as duas coisas.
  8. ✅ `docker build -t t4p-app-test-05 .` → sucesso. `docker run` com `ADMIN_USER`/`ADMIN_PASS`/`PRECO=49.90` de teste → depois de ~35 s (`start-period=20s` + 1 ciclo de `interval=30s`), `docker inspect --format='{{.State.Health.Status}}'` → `healthy`. `curl /health` e `curl /` (preço "R$ 49,90") confirmados dentro do container. Imagem e container de teste removidos ao final.
- **Divergências:**
  - **Item 8 do mecanismo ("aviso de banco novo"):** a tarefa descreve a condição como "se o banco acabou de ser criado ... e `NODE_ENV=production`, grave console.warn ... Grave também um evento `db_criado`." Li a condição de produção como aplicável só ao `console.warn` (ruído indesejado em dev/teste, onde o banco é recriado toda hora), e deixei o evento `db_criado` sempre gravado quando o arquivo é novo, independente do ambiente — um evento de auditoria não tem por que sumir fora de produção, e é o `console.warn` que existe especificamente para chamar atenção num redeploy de produção. Se a leitura pretendida era condicionar as duas coisas a `NODE_ENV=production`, é uma mudança de uma linha (mover o `registrarEvento` para dentro do `if`).
  - **Selo "chip/kicker laranja":** a tarefa não define o marcado exato; reaproveitei o `.hero-tag` (já existia, usado uma vez no hero) nos dois lugares pedidos (hero e `#oferta`), com uma classe modificadora só para o espaçamento (`.selo-lancamento`). Não criei um componente novo.
  - **Campo "Valor (R$)" do formulário de cadastro manual em `/admin` (`admin.html:97`):** o valor default passou a vir de `precoAtual().toFixed(2)` (antes `process.env.PRECO || "97.00"`) — mesma fonte, mas mantive o formato com ponto (não `precoBRL`, que usa vírgula), porque é um `<input inputmode="decimal">` editável, não um preço "exibido"; a tarefa pede `formatarBRL`/`precoBRL` "usado em ... /admin", o que já está satisfeito pelo `somaFormatada` e pelo `valor` de cada linha da tabela (ambos com `formatarBRL`, vírgula).
- **Achados** (fora do escopo, não corrigidos):
  - Ao implementar o fix da coluna WhatsApp com `overflow-wrap: anywhere` no `th,td` genérico (primeira tentativa), a propriedade é herdada pelos filhos — o botão "Nova senha" da coluna Ações passou a quebrar letra a letra (`N`/`o`/`v`/`a`/.../`h`/`a` numa coluna estreitíssima), porque o navegador calcula uma largura mínima de conteúdo muito menor com `anywhere`. Vi isso no primeiro screenshot do `e2e` e troquei para `td:nth-child(1,2,3)` antes de commitar — não ficou no histórico como regressão, mas registro aqui porque quase passou.
  - No screenshot final (`docs/claude-bridge/evidencias/tarefa-05-admin-email-longo.png`), a coluna "Ações" aparece cortada na borda direita — a tabela (`overflow-x:auto`) já é um pouco mais larga que o viewport padrão do `page.screenshot()` sem `fullPage`. Não é overflow de conteúdo (o texto do botão está normal, só a página é mais larga que a captura); não mexi nisso, é um comportamento pré-existente do layout responsivo da tabela, fora do que a tarefa pediu.
  - `docker build` imprime o aviso de rotina do npm sobre nova versão disponível; sem relação com esta tarefa (mesmo achado já registrado na tarefa 04).
- **Commit/branch:** branch `tarefa/05-preco-lancamento`, criada a partir da `main` atualizada (que já tinha as tarefas 03+04 mergeadas, PR #4). Commits: `11a52fe` (docs pendentes do planejador — inclui o arquivamento da tarefa 04), `d1d0350` (preço numa fonte só + garantia + prazo de acesso + aviso do PIX válido + eventos com origem), `058b9c6` (aviso de banco novo), `f8d240f` (fix do overflow no `/admin`), `a88afa1` (testes do `e2e.js` + screenshot), `9efd352` (backlog). Fiz o push da branch e abri o PR `tarefa/05-preco-lancamento → main`. Sem merge.
