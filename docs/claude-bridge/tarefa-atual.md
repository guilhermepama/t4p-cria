# Tarefa 07 — Ajuste de diagramação mobile: navbar e seção de preço

**Status: AGUARDANDO EXECUÇÃO**

- Tipo: código (CSS apenas, sem mudança de estrutura HTML nem de lógica)
- Data: 23/09/2026
- Base: tarefas 01–06 concluídas e mergeadas; produção em https://iadojeitocerto.com conferida em 23/09 (print mobile ≈390px enviado pelo Guilherme)
- ⚠️ Produção está vendendo até sexta 25/09 às 14h. A mudança precisa ser de baixo risco, reversível e não pode tocar checkout, /comprar, webhook ou VENDAS_ATE.

## Objetivo

Corrigir dois bugs visuais que prejudicam a conversão no mobile: o preço "49,90" encosta ou passa da borda do card, e o link de garantia para o WhatsApp aparece com o azul padrão do navegador. Aproveitar a mesma passada para ajustar a diagramação da navbar e da seção de preço em telas até 480px. O desktop não deve mudar, exceto a cor do link, que é um bug em qualquer largura.

## Mecanismo proposto

Validar cada item contra o código real, porque os seletores abaixo são ilustrativos. Se algo divergir, reporte em vez de improvisar.

1. **Link da garantia**, em todas as larguras: o `<a>` dentro do card de preço deve usar a cor de destaque do tema (a mesma dos acentos laranja), com `text-underline-offset: 3px`, e um estado `:visited` com a mesma cor. Conferir se existem outros `<a>` sem estilo na landing e reportar o que encontrar, sem corrigir o que estiver fora deste escopo.
2. **Navbar**, com `@media (max-width: 480px)`:
   - esconder o nome "IA para Negócios", deixando só "T4P." e o botão;
   - botão "Quero o kit" menor, com padding em torno de 10px 18px, fonte de 15px e altura de toque de no mínimo 44px.
3. **Selo de prazo**, no mesmo breakpoint:
   - `border-radius: 16px`, no lugar da pílula de raio 999px;
   - `letter-spacing` em torno de .08em, fonte de 11px e padding de 10px 16px;
   - o ponto indicador deve ficar alinhado com a primeira linha do texto, e não solto à esquerda;
   - se for possível só com CSS, ou com um `<br>`/`<span>` já existente, a hierarquia deve ser "PREÇO DE LANÇAMENTO" em caixa alta e "até sexta, 25/09, às 14h" em peso normal. Se isso exigir mudar a estrutura, não faça e reporte. O texto não pode ser alterado.
4. **Preço**:
   - valor com `font-size: clamp(56px, 19vw, 88px)` e `letter-spacing: -0.03em`;
   - "R$" proporcional, em torno de .35em do valor;
   - requisito: nenhum pixel do preço pode encostar no padding do card em 360px.
5. **Card**: padding em torno de 28px 20px no mobile, para eliminar o padding duplo entre a seção e o card.
6. **CTA "Quero começar agora"**: o texto deve caber em 1 linha em 360px. Para isso, reduzir o círculo do ícone para cerca de 40px, usar `white-space: nowrap` e fonte de 17px. Se mesmo assim estourar em 360px, descer a fonte para 16px. **Não trocar o texto do botão**, porque isso é decisão de produto.
7. Não sobrescrever regras de desktop. Tudo o que for novo, exceto o item 1, fica dentro da media query.

## Fora de escopo

- Qualquer mudança de texto ou copy, preços, selos ou prazos.
- Checkout, /comprar, /pagamento, /aluno, /admin, webhook, variáveis de ambiente, VENDAS_ATE.
- Outras seções da landing, mesmo que também tenham problemas no mobile. Anote no relatório e não corrija.
- Refatoração de CSS, troca de fontes, novas dependências.

## Validação

- [ ] Prints da landing em 360px, 390px e 430px (navbar e seção de preço), antes e depois, anexados ao PR.
- [ ] Preço sem corte em 360px.
- [ ] CTA em 1 linha em 360px.
- [ ] Link da garantia na cor de destaque e abrindo o WhatsApp correto (variável WHATSAPP).
- [ ] Desktop (≥1024px) visualmente igual ao atual, exceto a cor do link.
- [ ] e2e completo (11 passos) verde.
- [ ] Nenhum arquivo fora de CSS/templates da landing alterado. Listar os arquivos no relatório.

## Entrega

- Branch a partir de `main` atualizada: `fix/mobile-preco-navbar`.
- PR com base em `main`, **sem mergear**. Prints e resultado do e2e na descrição.
- Atualizar o doc de estado do projeto no mesmo PR, com uma linha sobre o ajuste mobile.
- Preencher o relatório abaixo e mudar o Status para CONCLUÍDA, ou para BLOQUEADA com o motivo.

## Relatório do executor

_(preencher aqui)_
