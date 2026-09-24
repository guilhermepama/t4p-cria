# Tarefa 16 — Aluno troca a própria senha em /aluno/senha

**Status: AGUARDANDO EXECUÇÃO**

- Tipo: revisão + push + PR de uma implementação já feita fora do fluxo normal (pelo planejador, a pedido direto do Guilherme, por causa do prazo de sexta).
- Data: 24/09/2026
- Base: `main` (`36c0928`, já com as tarefas 13/14/15 mergeadas).
- **Branch:** `tarefa/16-trocar-senha`, já criada a partir da `origin/main` atualizada. Já existe 1 commit nela: `5b3fcc0 feat: aluno altera a própria senha em /aluno/senha`.
- ⚠️ Produção vendendo até sexta 25/09 às 14h. Não tocar checkout, webhook, /pagamento, VENDAS_ATE, CSVs, navegação das aulas — exceto para investigar os achados abaixo, se precisar.

## Contexto (divergência de processo)

Esta tarefa foi implementada e commitada pelo planejador diretamente (sessão Cowork, sem `git push`/`gh` disponíveis no ambiente onde rodou), a pedido do Guilherme, para não perder o prazo de sexta. **Isso não é o normal — o esperado é o executor implementar.** Revise como se a tarefa fosse sua, não confie cegamente no diff.

## Decisão do Guilherme

Aluno troca a própria senha pelo painel `/aluno` (não pelo `/admin`, que é Basic Auth e não tem sessão de aluno). Ao trocar: a sessão atual continua ativa, as sessões de outros dispositivos são encerradas.

## O que já foi feito (revisar)

- `src/db.js`: `trocarSenhaMantendoSessao(userId, senhaHash, tokenHashAtual)` — troca a senha e apaga as outras sessões do usuário numa transação.
- `src/auth.js`: `tokenHashDaSessao(req)` — expõe o hash do token da sessão atual (para não derrubá-la).
- `src/server.js`: `GET/POST /aluno/senha`, atrás de `requireAluno` + `checarOrigem` + rate-limit próprio (10/15min por aluno). Valida senha atual, nova com 8–200 caracteres, confirmação igual à nova, nova ≠ atual. Registra evento `aluno_trocou_senha`.
- `src/views/senha.html`: tela nova, visual igual ao `/entrar`.
- `src/views/aluno.html`: link "Alterar senha" no cabeçalho, ao lado de "Sair".
- `scripts/e2e.js`: 6 passos novos cobrindo o fluxo (login em 2 dispositivos, exige sessão, CSRF, validações, troca com sucesso derruba o outro dispositivo, senha antiga não entra mais, prints 390/1280).
- `docs/t4p-01-especificacao.md`: linha da rota `/aluno/senha` + nota de segurança sobre invalidar sessões na troca.

## O que falta (seu trabalho)

1. Revisar `git show 5b3fcc0` inteiro. Se achar algo errado, corrija — é bug desta tarefa, não "achado fora do escopo".
2. Rodar `npm run e2e` completo **nesta máquina** (rede real — o ambiente onde rodei bloqueia o Google Fonts, o que já explica parte das falhas abaixo). Esperado: tudo verde, incluindo os 6 passos novos de "senha:".
3. Investigar os 2 achados abaixo antes de decidir se são bug desta tarefa ou pré-existentes.
4. `git push -u origin tarefa/16-trocar-senha`.
5. Abrir o PR para `main` (sem merge — o merge é do Guilherme). Descrição do PR: o que mudou + link para esta tarefa.
6. Preencher o relatório e mudar o Status.

## Achados a investigar (do meu e2e, rodado em ambiente com rede restrita)

- `avaliação: ALUNO_AVAL sem erro de console` falhou com 3× `429 Too Many Requests`. Pode ser rate-limit de `/aluno/avaliacao` ou `/aluno/progresso` estourado pela ordem dos testes (os 6 passos novos de senha rodam antes e mudam o tempo). Rode a suíte na `main` (sem esta tarefa) para comparar: se falhar lá também, é pré-existente — registre em Achados e não corrija; se só falhar aqui, é bug desta tarefa.
- `avaliação: /aluno com Aula 3 concluída e sem 'final' mostra só o cartão final` falhou em "cartão deveria ser o final". Mesma investigação.
- As falhas de fonte ("fontes não carregaram") no meu ambiente são quase certamente rede bloqueada (Google Fonts), não bug — mas confirme que ficam verdes na sua máquina antes de assumir isso.

## Validação

- [ ] `git diff main...tarefa/16-trocar-senha --stat`: só os arquivos listados acima.
- [ ] `npm run e2e`: 100% verde (contando os 6 novos de "senha:").
- [ ] Achados 429 / cartão final resolvidos ou confirmados como pré-existentes (não desta tarefa).
- [ ] Teste manual rápido no navegador: trocar a senha, confirmar que o outro dispositivo desloga e a senha antiga não entra mais.

## Entrega

- Push da `tarefa/16-trocar-senha` + abrir PR para `main` (sem merge).
- Preencher o relatório e mudar o Status. Colocar o link do PR no relatório.

## Relatório do executor

(preencher)
