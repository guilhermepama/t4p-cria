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

| 23/09 | Não há aula grátis: a amostra é o e-book (PDF). As 3 aulas são exclusivas de quem pagou | Decisão do Guilherme |
| 23/09 | Na área do aluno, o bloco de venda da Aula 1 vira cartão "Próxima: Aula 2" | Quem já pagou não vê oferta |
| 23/09 | bcrypt trocado por `crypto.scrypt` nativo | Remove dependência nativa com vulnerabilidade transitiva (tar/node-pre-gyp) |
| 23/09 | CSP com `unsafe-inline` aceita | Landing/aulas usam inline; sem HTML gerado por usuário |

| 23/09 | Checkout e webhook numa tarefa só (03) | Um fluxo só; o teste de R$ 1 precisa dos dois |
| 23/09 | Sem `notification_url` no pagamento; só o webhook do painel da aplicação T4P | Uma fonte assinada, sem notificações duplicadas |

## Pendências de produto (do Guilherme, não do executor)

- Garantia de 7 dias: sim ou não? (a landing tem um aviso âmbar)
- Prazo de acesso à área do aluno depois do encerramento (a landing tem um aviso âmbar)
- Preço para equipes (sugestão: R$ 79/acesso a partir de 3, sem anunciar)
- Número de WhatsApp real para a landing/FAQ

## Backlog

1. ~~Esqueleto + Dockerfile + landing no ar~~ — feito na tarefa 01, mergeado na main
2. ~~Login, área do aluno, conteúdo protegido + /admin completo~~ — feito na tarefa 02, aguardando merge
3. (fundido no item 2)
4. ~~Checkout PIX + tela de QR + polling + webhook + /privacidade~~ — feito na tarefa 03, aguardando merge
5. (fundido no item 4)
6. Teste real com R$ 1 e go-live com R$ 97
7. Remoção dos avisos âmbar (depende das decisões de garantia/prazo) + favicon/og-image

### Registro rápido (micro-correções, sem tarefa)

- favicon e og-image inexistentes (achado da tarefa 01) — criar antes da divulgação (Guilherme: arte)
