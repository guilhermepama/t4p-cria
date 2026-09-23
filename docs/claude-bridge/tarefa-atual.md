# Tarefa 08 — Acesso de quem já comprou: "Entrar" na landing + "Esqueci minha senha"

**Status: AGUARDANDO EXECUÇÃO**

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

_(preencher aqui)_
