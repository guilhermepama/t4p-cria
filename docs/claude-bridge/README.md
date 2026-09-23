# claude-bridge · canal planejador ↔ executor

Pasta de passagem de trabalho entre as duas sessões do Claude.

| Papel | Quem | Faz |
|---|---|---|
| Planejador | Claude no Cowork (projeto T4P) | Lê o relatório, revisa, arquiva e escreve a próxima tarefa |
| Executor | Claude Code nesta pasta (`09_App/t4p-app`) | Executa `tarefa-atual.md`, testa e preenche o relatório |
| Dono | Guilherme | Decide produto, faz merge, deploy, painéis (DNS, MP, Coolify) |

## Arquivos

- `00-plano-lancamento.md` — plano geral e cronograma
- `tarefa-atual.md` — **a única** tarefa ativa
- `concluidas/NN-nome.md` — histórico (o planejador arquiva)

## Ciclo

1. O planejador escreve `tarefa-atual.md` com Status `AGUARDANDO EXECUÇÃO`.
2. O Guilherme abre uma sessão nova do executor na pasta `09_App/t4p-app` e diz: *"execute a tarefa atual"*.
3. O executor trabalha na branch `tarefa/NN-…`, preenche o relatório e muda o Status para `CONCLUÍDA` ou `BLOQUEADA`.
4. O Guilherme revisa, faz merge na `main` (e o Coolify faz o deploy) e avisa o planejador.
5. O planejador lê o relatório, arquiva em `concluidas/` e escreve a próxima tarefa.

## Status possíveis

`AGUARDANDO EXECUÇÃO` → `EM EXECUÇÃO` → `CONCLUÍDA` | `BLOQUEADA`

Uma tarefa por vez. Tarefa bloqueada é destravada e reescrita, não pulada.
