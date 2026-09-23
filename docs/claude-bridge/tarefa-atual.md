# Tarefa 08 — Acesso de quem já comprou: "Entrar" na landing + "Esqueci minha senha"

**Status: CONCLUÍDA**

- Tipo: código (templates + CSS + e2e). Sem rota nova de backend, sem dependência nova, sem e-mail.
- Data: 23/09/2026
- Base: tarefas 01–07 concluídas e mergeadas (main em a5a6893). A 07 criou a `@media(max-width:480px)` do header: estender essa, não criar outra.
- ⚠️ Produção vendendo até sexta 25/09 às 14h. Não tocar checkout, webhook, /pagamento, VENDAS_ATE.

## Objetivo

Hoje quem já comprou e volta ao site não acha onde entrar: a landing não tem link para `/entrar`, e quem esqueceu a senha fica preso na tela de erro. A área do aluno fica no ar até 24/12, então esse caminho vai ser mais usado depois do encerramento das vendas do que agora.

## Decisão de produto que não muda

"Esqueci minha senha" **não** envia e-mail. Vale a decisão de 22/09 (sem e-mail transacional; senha redefinida pelo /admin, botão "Nova senha" que já existe). O link abre o WhatsApp da T4P com mensagem pronta; o Guilherme redefine no /admin e responde com a senha nova.

## Mecanismo proposto

Validar contra o código real (seletores ilustrativos). Se divergir, reporte.

1. **Header da landing (`public/index.html`)**
   - Adicionar `<a class="header-login" href="/entrar">Entrar</a>` antes do botão "Quero o kit", agrupados num wrapper à direita.
   - Estilo: link de texto (sem fundo), cor `--muted`/texto claro, hover na cor de destaque (peach), peso 600, altura de toque ≥ 44px.
   - Desktop: gap ~20px entre "Entrar" e o botão. Mobile (≤480px, dentro da media query já criada na 07): gap ~12px. Em 360px, "T4P." + "Entrar" + "Quero o kit" cabem numa linha, sem scroll horizontal.
   - Não mexer no resto do header nem no que a 07 ajustou.

2. **`/entrar` (`src/views/entrar.html` + rota GET/POST em `src/server.js`)**
   - Abaixo do campo Senha, alinhado à direita, link "Esqueci minha senha" (fonte ~13.5px, cor muted, hover peach).
   - `href` gerado no servidor com `linkWhatsapp("Oi! Esqueci minha senha do kit IA para Negócios. Meu e-mail de cadastro é: ")`, passado ao template por placeholder (ex.: `{{linkEsqueci}}`) nas 3 renderizações de `entrar.html` (GET, 401, 403). `target="_blank" rel="noopener"`.
   - Script inline pequeno (CSP já aceita inline): no clique, se o campo e-mail estiver preenchido, anexar o e-mail digitado (com `encodeURIComponent`) ao `text` do link. Sem e-mail, segue a mensagem base.
   - No rodapé do card, acima de "Privacidade": "Ainda não tem o kit? <a href="/">Conhecer o kit</a>".

3. **Mensagem de erro 401** — manter "E-mail ou senha incorretos." (não revelar se o e-mail existe). Sem mudança.

4. **`/comprar` (`src/views/comprar.html`)** — linha discreta abaixo do título ou acima do botão: "Já comprou? <a href="/entrar">Entrar</a>". Nada mais nessa tela.

5. **`vendas-encerradas.html`** — acrescentar "Já é aluno? <a href="/entrar">Entrar na área do aluno</a>". Depois de 25/09 às 14h é a tela que quem vem de /comprar vê.

## Fora de escopo

- Redefinição de senha por e-mail, token ou rota `/esqueci-senha` com formulário.
- Troca de senha pelo próprio aluno na área logada (pode virar tarefa depois, se aparecer demanda).
- Qualquer copy da landing além do link "Entrar".
- Checkout, webhook, /admin, variáveis de ambiente.

## Validação

- [ ] Landing: link "Entrar" leva a `/entrar` (desktop 1280px e mobile 360/390px). Prints.
- [ ] 360px: header numa linha, `document.documentElement.scrollWidth <= clientWidth`.
- [ ] `/entrar`: "Esqueci minha senha" presente nos 3 estados (GET, 401, 403), com `href` `https://wa.me/<WHATSAPP>?text=...` usando a env WHATSAPP.
- [ ] Com e-mail digitado, o link aberto contém o e-mail (Playwright: interceptar popup ou ler o href após o clique).
- [ ] `/comprar` e `vendas-encerradas` têm link para `/entrar`.
- [ ] Desktop da landing igual ao atual, exceto o link novo.
- [ ] e2e completo verde, com os passos novos acima adicionados ao `scripts/e2e.js` (em navegador real).

## Entrega

- Branch a partir da `main` atualizada (já com a 07): `tarefa/08-entrar-esqueci-senha`.
- PR com base em `main`, **sem mergear**. Prints e resultado do e2e na descrição.
- Atualizar `docs/t4p-00-estado.md`: decisão "23/09 · Esqueci a senha = WhatsApp + /admin (sem e-mail)" e item no backlog.
- Preencher o relatório e mudar o Status.

## Relatório do executor

- **Status:** CONCLUÍDA
- **Feito:**
  - `public/index.html`: header ganhou `.header-actions` (wrapper à direita) com `<a class="header-login" href="/entrar">Entrar</a>` antes do "Quero o kit"; gap 20px desktop / 12px em `@media(max-width:480px)` (mesma media query da tarefa 07).
  - `src/views/entrar.html`: link "Esqueci minha senha" abaixo da Senha (`#esqueci-link`, alinhado à direita, muted → peach no hover), com script inline que anexa o e-mail digitado (via `encodeURIComponent`, idempotente a múltiplos cliques) ao `href` no clique; rodapé ganhou "Ainda não tem o kit? Conhecer o kit" acima de "Privacidade".
  - `src/server.js`: nova `linkEsqueciSenha()` passada como `linkEsqueci` nas 3 renderizações de `entrar.html` (GET, 401, 403).
  - `src/views/comprar.html`: linha "Já comprou? Entrar" abaixo do título.
  - `src/views/vendas-encerradas.html`: linha "Já é aluno? Entrar na área do aluno".
  - `scripts/e2e.js`: 9 passos novos (header responsivo com prints, `/entrar` nos 3 estados com o link e o href, e-mail anexado ao link, `/comprar` e vendas-encerradas com link para `/entrar`) + correção de um id de pagamento fake que estava fixo em "1000" no passo (c) (ver Divergências).
  - `docs/t4p-00-estado.md`: decisão 23/09 "Esqueci a senha = WhatsApp + /admin" e backlog do item da tarefa 08 marcado como feito.
- **Validação:**
  - ✅ Landing: link "Entrar" leva a `/entrar` em 1280/360/390px — passo `landing: link 'Entrar' do header leva a /entrar...` no e2e; prints em `docs/claude-bridge/evidencias/tarefa-08-header-{desktop-1280,mobile-360,mobile-390}.png`.
  - ✅ 360px sem scroll horizontal — mesmo passo, `document.documentElement.scrollWidth <= clientWidth` conferido via `page.evaluate`.
  - ✅ "Esqueci minha senha" nos 3 estados (GET, 401, 403) com `href` `https://wa.me/<WHATSAPP>?text=...` — 3 passos dedicados no e2e (usa o WHATSAPP padrão do ambiente de teste, `5519974139426`).
  - ✅ E-mail digitado aparece no link após o clique — passo dedicado, lê o `href` do próprio link após o clique (sem depender da aba `wa.me` carregar, conforme sugerido na tarefa).
  - ✅ `/comprar` e `vendas-encerradas` com link para `/entrar` — passo dedicado para `/comprar`; para `vendas-encerradas`, checagem incluída no bloco existente de encerramento de vendas (`VENDAS_ATE` no passado).
  - ✅ Desktop da landing igual ao atual, exceto o link novo — nenhuma outra regra de CSS/HTML fora do header foi tocada; print em `tarefa-08-header-desktop-1280.png` confirma.
  - ✅ `npm run e2e` verde: **18/18 passos OK** (rodado em navegador real, Chromium via Playwright, duas vezes após o ajuste de Divergências).
- **Divergências:**
  - O novo passo "cria usuário inativo (para o 403)" faz um `/comprar` de verdade contra o `mp-fake`, o que consome um id da sequência `1000, 1001, ...`. Isso quebrava o passo (c) pré-existente, que tinha o id `1000` fixo (`/__set/1000`). Troquei esse trecho para extrair o id real do `copia-e-cola` (`PIXFAKE(\d+)`), do mesmo jeito que o bloco de encerramento de vendas já fazia — deixa o teste robusto à ordem/quantidade de pedidos criados antes dele, sem mudar nenhum comportamento do app.
  - Não criei uma rota `/esqueci-senha` nem nada de back-end novo: o mecanismo é só o link `mailto`-like de WhatsApp já especificado; nenhuma rota nova foi adicionada a `src/server.js`.
- **Achados (fora do escopo, não corrigidos):**
  - `conteudo/Aula1_O_Pedido_que_Funciona.html`, `Aula2_Conserte_a_Resposta.html` e `Aula3_Monte_sua_Equipe.html` apareceram **modificados na working tree antes de eu tocar em qualquer arquivo** (branch criada a partir de uma `main` limpa; eu só editei os 6 arquivos listados em "Feito"). O diff é grande (~240 linhas por arquivo, um tema "T4P" sobrepondo o CSS original das aulas). Não sei a origem — não veio de commit, stash, nem de nada que rodei (grep confirma que nenhum script em `src/` ou `scripts/` escreve em `conteudo/`). Não toquei nem commitei essas mudanças; ficaram como estavam na working tree, fora do commit desta tarefa. Vale conferir se é trabalho em andamento salvo localmente (ex.: sincronização de pasta) antes de descartar.
  - `docs/claude-bridge/evidencias/tarefa-05-admin-email-longo.png` foi regravado ao rodar o e2e completo (screenshot não-determinístico da tarefa 05); restaurei a versão do commit antes de finalizar, para não misturar com esta tarefa.
- **Commit/branch:** branch `tarefa/08-entrar-esqueci-senha` (`e2957fa`), criada a partir de `main` em `6b9784e`. PR: https://github.com/guilhermepama/t4p-cria/pull/8 (sem merge).
