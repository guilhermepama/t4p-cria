# Tarefa 17 — Gerador de pedido como ferramenta, com atalho no /aluno

**Status: AGUARDANDO EXECUÇÃO**

- Tipo: revisão + e2e + push + PR de uma implementação já feita pelo planejador (a pedido direto do Guilherme, mesmo esquema da tarefa 16).
- Data: 24/09/2026
- Base: `origin/main` (`29a2d8d`, já com a tarefa 16 mergeada).
- **Branch:** `tarefa/17-gerador-de-pedido`, já criada. Já existe 1 commit de implementação nela.
- ⚠️ Produção vendendo até sexta 25/09 às 14h. Não tocar checkout, webhook, /pagamento, VENDAS_ATE, CSVs, navegação das aulas.

## Decisão do Guilherme

O exercício "Sua vez: monte o pedido do seu negócio" da Aula 1 (o gerador de prompt pelo método CAFÉ) vira uma ferramenta de uso contínuo, com atalho na página inicial do aluno (`/aluno`).

## O que já foi feito (revisar)

- `conteudo/Ferramenta_Gerador_de_Pedido.html` (novo): mesmo `<head>`/CSS da Aula 1 (linhas 1–510 copiadas, só o `<title>` muda) + corpo próprio, sem passos, sem barra inferior, **sem** POST de progresso e **sem** avaliação.
  - Mesmos campos/chips e mesma montagem do texto da Aula 1, mais: chip "Outra coisa" com campo livre de ação, campo "Mais algum detalhe?" no Formato, botão "Limpar tudo", lembrete de não colar dados de clientes, link de volta para `/aluno`.
  - localStorage próprio (`ia-negocios-gerador`). Na primeira abertura, se não houver nada, lê `ia-negocios-aula1` (o que o aluno preencheu na aula) e avisa "Trouxemos o que você preencheu na Aula 1". "Limpar tudo" salva o estado vazio para não voltar a puxar a Aula 1. Tudo em try/catch.
- `src/server.js`: array `FERRAMENTAS` (entra na lista branca como `html`, servido pela rota protegida existente `/aluno/conteudo/:arquivo`), `cartaoFerramentaHtml()` e `ferramentasHtml` no render do `/aluno`.
- `src/views/aluno.html`: seção "Ferramentas" entre "Suas aulas" e "Seus arquivos" (cartão com borda laranja, botão "Abrir gerador", abre em nova aba); texto das boas-vindas cita o gerador.
- `docs/t4p-01-especificacao.md`: linha da rota `/aluno/conteudo/:arquivo` cita ferramentas.

Verificação do planejador (Playwright, 390 e 1280, app local com banco novo): cartão aparece no /aluno; abre em nova aba; restaura da Aula 1 e mostra o aviso; "Outra coisa" mostra o campo e entra na prévia; detalhe extra entra no Formato; sem rolagem horizontal; recarregar mantém; "Limpar tudo" zera e não volta a puxar a Aula 1; sem sessão → 302. Único erro de console foi Google Fonts bloqueado no ambiente do planejador.

## O que falta (seu trabalho)

1. Revisar o commit de implementação inteiro. Bug encontrado aqui é desta tarefa: corrija.
2. Adicionar passos "gerador:" no `scripts/e2e.js` cobrindo, no mínimo: cartão no /aluno + link abre `/aluno/conteudo/Ferramenta_Gerador_de_Pedido.html`; sem sessão não entrega; prévia muda ao preencher e ao escolher "Outra coisa"; restauração a partir de `ia-negocios-aula1`; "Limpar tudo"; sem scroll horizontal em 360/390; sem erro de console; prints 390/1280 em `docs/claude-bridge/evidencias/tarefa-17-gerador/`.
3. Conferir que os passos existentes que contam/identificam cartões do /aluno (`.card[data-aula=…]`) seguem verdes — o cartão novo também usa `.card`, mas com `data-ferramenta`.
4. `npm run e2e` completo: 100% verde. Descarte as regravações de PNGs de tarefas antigas (achado da tarefa 16).
5. `git push -u origin tarefa/17-gerador-de-pedido` e abrir PR para `main` (sem merge).
6. Preencher o relatório e mudar o Status.

## Validação

- [ ] `git diff origin/main...tarefa/17-gerador-de-pedido --stat`: só os arquivos listados + e2e + evidências + docs do bridge.
- [ ] `npm run e2e`: 100% verde, incluindo os passos "gerador:".
- [ ] A ferramenta não grava nada em `/aluno/progresso` nem aparece no bloco "Uso do conteúdo" do /admin.
- [ ] Teste manual rápido: abrir pelo /aluno no celular, copiar o pedido e colar no ChatGPT.

## Entrega

- Push + PR para `main` (sem merge). Link do PR no relatório.

## Relatório do executor

(preencher)
