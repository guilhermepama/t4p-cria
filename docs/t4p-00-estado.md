# t4p-00 · Estado do produto

Fonte da verdade para **fatos do produto**. Sobre "o que fazer agora", quem manda é `claude-bridge/`.

Atualizado em 22/09/2026.

## Contexto

- Empresa CRIA do Empretec (Sebrae). Sócios: Guilherme Pama (produto/site), Felipe Andrade (marketing), Fernando Saad (administrativo).
- Operação de 21 a 25/09/2026. Encerramento até sexta 25/09 às 14h.
- Produto: kit **IA para Negócios** — 3 aulas interativas (HTML), kit PDF com 25 prompts, 3 assistentes (PDF + .txt), Manual de Integração (template + exemplo).
- **Preço: R$ 97,00.** Meta: 17 vendas.

## Decisões

| Data | Decisão | Motivo |
|---|---|---|
| 22/09 | Domínio **iadojeitocerto.com** (GoDaddy) | Comprado. Fica como ativo do Guilherme depois da liquidação |
| 22/09 | Stack Node + Express + SQLite, deploy via Coolify na VPS Hostinger | Um container, sem banco externo; aguenta milhares de alunos |
| 22/09 | PIX pela API de Pagamentos do MP, com QR no site | Taxa baixa, liberação automática |
| 22/09 | Mesma conta MP do Orbinote, com **aplicação separada "T4P"** | Isola o webhook e o token; `external_reference` com prefixo `T4P-` |
| 22/09 | Sem e-mail transacional: senha redefinida pelo /admin | ~17 clientes; um ponto de falha a menos |
| 22/09 | Balanço do Empretec usa o CSV do /admin, não o extrato do MP | O extrato mistura as vendas com as do Orbinote |
| 22/09 | Fallback: se o PIX automático não passar no teste real até **qua 23/09 às 22h**, vender com PIX direto + ativação manual no /admin | Não perder os dias de venda |

## Pendências de produto (do Guilherme, não do executor)

- Garantia de 7 dias: sim ou não? (a landing tem um aviso âmbar)
- Prazo de acesso à área do aluno depois do encerramento (a landing tem um aviso âmbar)
- Preço para equipes (sugestão: R$ 79/acesso a partir de 3, sem anunciar)
- Número de WhatsApp real para a landing/FAQ

## Backlog

1. ~~Esqueleto + Dockerfile + landing no ar~~ — feito na tarefa 01, aguardando merge
2. Cadastro, login, área do aluno, conteúdo protegido
3. /admin (fallback operacional)
4. Checkout PIX + tela de QR + polling
5. Webhook com assinatura + reconsulta
6. Teste real com R$ 1 e go-live com R$ 97
7. /privacidade + remoção dos avisos âmbar + `LINK_COMPRA`

### Registro rápido (micro-correções, sem tarefa)

_(vazio)_
