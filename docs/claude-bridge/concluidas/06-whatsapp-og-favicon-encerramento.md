# Tarefa 06 · WhatsApp de contato em todo o site

**Status: CONCLUÍDA**

- **Tipo:** código pequeno (texto + configuração).
- **Data:** 23/09/2026
- **Base:** `concluidas/05-preco-lancamento.md` (padrão `{{preco_brl}}` injetado pelo servidor)

## Decisão de produto

WhatsApp oficial da T4P: **(19) 97413-9426**, que no formato do wa.me fica `5519974139426`. É o número pessoal do Guilherme, por decisão dele.

## Antes de começar

Crie `tarefa/06-whatsapp` a partir da `main` atualizada. O primeiro commit leva só a documentação pendente do planejador (o arquivamento da 05 e o deploy): `docs: planejador — tarefa 06`.

## Mecanismo proposto

1. **Uma fonte só**, com o mesmo padrão do preço:
   - Variável `WHATSAPP` (só dígitos, com DDI). Se estiver vazia, o padrão no código é `5519974139426`.
   - Adicione ao `.env.example`.
   - O servidor injeta na landing `{{whatsapp}}` (os dígitos) e `{{whatsapp_fmt}}` (`(19) 97413-9426`).
   - A `const WHATSAPP = ""` da landing passa a receber `{{whatsapp}}`.
2. **Landing:**
   - O link do FAQ de equipes volta a funcionar (o JS já existe, só depende da constante preenchida).
   - Na garantia, "É só chamar a gente" vira link: "É só chamar a gente no WhatsApp".
   - No rodapé, acrescente "WhatsApp (19) 97413-9426" com link.
3. **Views:**
   - `comprar-indisponivel.html`: "fale com a gente" vira link do WhatsApp com a mensagem pronta "Oi! Quero comprar o kit IA para Negócios por PIX direto."
   - Mensagem de usuário inativo no `/entrar`: "fale com a gente" vira link com a mensagem "Oi! Já paguei o kit e meu acesso não foi liberado."
   - `pagamento.html`: acrescente, abaixo do QR, uma linha discreta: "Pagou e não liberou? Fale com a gente no WhatsApp."
   - `aluno.html`: no rodapé, "Dúvidas? WhatsApp (19) 97413-9426".
   - `privacidade.html`: acrescente o WhatsApp ao contato, junto com o e-mail.
4. Todos os links usam `https://wa.me/<digitos>?text=<encodeURIComponent(msg)>`, com `target="_blank" rel="noopener"`.

## Acréscimo do planejador (23/09): imagem de compartilhamento

5. Copie `../../04_Marketing/Criativos/og-image.jpg` (1200×630, 79 KB) para `public/og-image.jpg`. Na landing, acrescente:
   `og:image` = `https://iadojeitocerto.com/og-image.jpg`, `og:image:width` 1200, `og:image:height` 630, `og:image:alt` "A IA não é fraca. Ela só não conhece o seu negócio. Kit IA para Negócios, R$ 49,90", `twitter:card` = `summary_large_image`.
   Validação: `curl -I /og-image.jpg` → 200 `image/jpeg`. O e2e confere que a meta `og:image` existe e aponta para um arquivo que responde 200.

6. **Favicon:** copie os 5 arquivos de `../../04_Marketing/Criativos/favicon/` para `public/` (`favicon.ico`, `favicon-32.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`). Acrescente no `<head>` da landing **e de todas as views** (comprar, pagamento, entrar, aluno, admin, privacidade, comprar-indisponivel): `<link rel="icon" href="/favicon.ico" sizes="any">`, `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`. Validação: `curl -I /favicon.ico` → 200, e o e2e confere que o `link[rel=icon]` existe na landing e no `/aluno`.

7. **Encerramento automático das vendas: sexta, 25/09, às 14h (horário de Brasília).** A empresa é liquidada às 14h, então venda depois disso não entra no balanço.
   - Crie a variável `VENDAS_ATE` (ISO com offset). O padrão é `2026-09-25T14:00:00-03:00`. Acrescente no `.env.example`.
   - Depois desse horário, `GET` e `POST /comprar` e `POST /pagamento/:token/novo` mostram uma página "Vendas encerradas" (status 410), com o link do WhatsApp e sem criar usuário nem pedido.
   - Um PIX **gerado antes** das 14h e pago depois continua sendo liberado pelo webhook e pela reconsulta, porque é uma venda já feita. O `/api/pedido` e o `/pagamento/:token` continuam funcionando.
   - Na landing, se as vendas estiverem encerradas, o servidor troca o selo de lançamento por "Vendas encerradas". Os botões de compra continuam levando ao `/comprar`, que mostra a página de encerramento.
   - O login e a área do aluno **não mudam**. O acesso continua até 24/12.
   - Validação: com `VENDAS_ATE` no passado, o `/comprar` responde 410 e nada é gravado no banco, e um pedido pendente criado antes ainda vira `pago` no `mp-fake`. Com `VENDAS_ATE` no futuro, tudo funciona como antes. Acrescente os dois casos ao e2e.

## Fora de escopo

Mudanças de preço, de texto de oferta ou em `conteudo/`.

## Validação

1. `grep -rn "fale com a gente\|chamar a gente" src/views public` → todas as ocorrências viraram link.
2. O `npm run e2e` passa. Acrescente um passo: a landing tem pelo menos 3 links `wa.me/5519974139426`, e nenhum `{{whatsapp` sobra no HTML.
3. Com `WHATSAPP=5511900000000`, a landing e as views mostram o número novo. Isso prova que existe uma fonte só.
4. `docker build` passa.

## Entrega

Branch `tarefa/06-whatsapp`. Push liberado para abrir o PR. Sem merge. Preencha o relatório e mude o Status.

## Relatório do executor

- **Status:** CONCLUÍDA

- **Feito:**
  - Fonte única do WhatsApp: `WHATSAPP` no `.env.example` (padrão `5519974139426`), helpers `whatsappContatoDigitos/Formatado`/`linkWhatsapp` em `src/server.js`, injetados na landing (`{{whatsapp}}`, `{{whatsapp_fmt}}`) e nas views via `render()`.
  - `public/index.html`: FAQ de equipe voltou a funcionar (só preencheu a constante), garantia e rodapé viraram links de WhatsApp, `target="_blank" rel="noopener"` em todos os links (inclusive o da FAQ, que não tinha).
  - `src/views/comprar-indisponivel.html`, `entrar` (mensagem de inativo em `server.js`), `pagamento.html`, `aluno.html`, `privacidade.html`: textos "fale/chame a gente" viraram links com a mensagem pronta pedida.
  - Imagem de compartilhamento: copiado `public/og-image.jpg`; metas `og:image(:width/:height/:alt)` e `twitter:card` na landing.
  - Favicon: copiados os 5 arquivos para `public/`; `<link rel="icon">`/`apple-touch-icon` em todas as views listadas (landing, comprar, pagamento, entrar, aluno, admin, privacidade, comprar-indisponivel).
  - Encerramento automático das vendas: `VENDAS_ATE` no `.env.example` (padrão `2026-09-25T14:00:00-03:00`), helpers `vendasAte/vendasEncerradas/seloVendas` em `server.js`. `GET`/`POST /comprar` e `POST /pagamento/:token/novo` respondem 410 com a nova view `src/views/vendas-encerradas.html` (link de WhatsApp) sem gravar nada no banco. Selo da landing troca para "Vendas encerradas" via `{{selo_texto}}`. `/api/pedido/:token`, `/pagamento/:token` (GET) e `/webhooks/mp` não mudaram.
  - `scripts/e2e.js`: 4 passos novos (links de WhatsApp na landing, meta `og:image` responde 200, favicon + `link[rel=icon]` na landing e no `/aluno`, e o cenário completo de `VENDAS_ATE` — reabre o mesmo banco com um servidor separado para simular passado/futuro).

- **Validação:**
  1. ✅ `grep -rn "fale com a gente\|chamar a gente" src/views public` → as 3 ocorrências (comprar-indisponivel, vendas-encerradas, garantia da landing) são links.
  2. ✅ `npm run e2e` → 11/11 passos OK, incluindo o passo novo dos links de WhatsApp (landing tem 2 links estáticos + o da FAQ via JS = 3, sem `{{whatsapp` sobrando).
  3. ✅ Rodei o server duas vezes (script manual, descartado depois) com `WHATSAPP=5511900000000`: landing, `/comprar` indisponível, rodapé, `/privacidade` e `const WHATSAPP` do JS todos mostraram `(11) 90000-0000` / `wa.me/5511900000000` — uma fonte só.
  4. ✅ `docker build` passa (rodei 3x, a cada rodada de mudanças); subi o container e confirmei `curl -I /og-image.jpg` → 200 `image/jpeg`, `curl -I /favicon.ico` → 200 `image/x-icon`.
  5. ✅ (item 5 do planejador) `og:image` responde 200/`image/jpeg` — conferido no e2e e via curl no container.
  6. ✅ (item 6) `favicon.ico` → 200; `link[rel=icon]` presente na landing e no `/aluno` (e2e).
  7. ✅ (item 7) Com `VENDAS_ATE` no passado: `GET`/`POST /comprar` → 410, nada gravado (conferido no `/admin`), `POST /pagamento/:token/novo` → 410; o pedido criado antes do encerramento foi aprovado no mp-fake e virou `pago` via `/api/pedido`, e `/pagamento/:token` continuou respondendo 200. Com `VENDAS_ATE` no futuro (padrão), tudo funciona como antes (suite inteira depende disso).

- **Divergências:**
  - A mensagem do link de `pagamento.html` ("Oi! Fiz o PIX do kit IA para Negócios e o acesso não foi liberado.") e a do link de dúvidas em rodapé/privacidade/aluno ("Oi! Tenho uma dúvida sobre o kit IA para Negócios.") não estavam especificadas no texto da tarefa — o mecanismo só dava o texto do botão, não a mensagem do wa.me. Escrevi mensagens curtas no mesmo padrão das que já tinham texto pronto; não é preço/oferta, mas registro aqui por não estar explícito.
  - Coloquei a linha do WhatsApp em `pagamento.html` logo abaixo da tag `<img class="qr">` (antes do "Copia e cola"), interpretando "abaixo do QR" ao pé da letra.
  - `src/views/vendas-encerradas.html` é um arquivo novo (não existia quando o item 7 foi escrito); copiei o layout de `comprar-indisponivel.html` e já incluí o favicon nela também, por consistência com o item 6.
  - A tarefa foi editada ao vivo pelo planejador durante a execução (itens 5, 6 e depois 7 apareceram em `tarefa-atual.md` depois que eu já tinha começado pelos itens 1–4). Segui em frente e implementei tudo, verificando que os assets de `04_Marketing/Criativos/` já existiam antes de copiá-los.

- **Achados:** nenhum novo fora do escopo.

- **Commit/branch:** branch `tarefa/06-whatsapp` (a partir da `main` em `a285077`). Commits: `docs: planejador — tarefa 06` (967a26b) e `feat: WhatsApp de contato, imagem de compartilhamento, favicon e encerramento automático das vendas` (376438a).
