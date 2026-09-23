# t4p-00 · Estado do produto

Fonte da verdade para **fatos do produto**. Sobre "o que fazer agora", quem manda é `claude-bridge/`.

Atualizado em 22/09/2026.

## Contexto

- Empresa CRIA do Empretec (Sebrae). Sócios: Guilherme Pama (produto/site), Felipe Andrade (marketing), Fernando Saad (administrativo).
- Operação de 21 a 25/09/2026. Encerramento até sexta 25/09 às 14h.
- Produto: kit **IA para Negócios** — 3 aulas interativas (HTML), kit PDF com 25 prompts, 3 assistentes (PDF + .txt), Manual de Integração (template + exemplo).
- **Preço: R$ 49,90 (preço de lançamento até 25/09 às 14h; antes R$ 97).** Meta R$ 1.600 → 33 vendas.

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

| 23/09 | Cloudflare na frente (proxied), mesma VPS e firewall do Orbinote; `TRUST_PROXY=2` | Firewall só aceita tráfego do Cloudflare |
| 23/09 | Formulários sempre validados em navegador real (Playwright) | Bug de `Origin: null` passou por todos os testes com curl |
| 23/09 | Tarefas 03 e 04 vão juntas num PR só | A 03 sozinha publicaria um checkout quebrado pelo mesmo bug |

| 23/09 | Volume Mount `/app/data` validado em produção (aluno persiste após redeploy) | Venda por PIX direto + cadastro manual liberada |

| 23/09 | **Checkout PIX automático validado em produção** (PIX real gerado, pago e acesso liberado sozinho) | Venda automática aberta |
| 23/09 | Webhook de produção validado: notificação simulada do MP chegou com assinatura válida (mp_erro 404 esperado para o id fictício 123456) | Cliente que fecha a página também é liberado |

| 23/09 | Preço de lançamento R$ 49,90 até 25/09, sem preço riscado | "De R$ 99,80" nunca foi praticado (CDC, propaganda enganosa) |
| 23/09 | Garantia de 7 dias com reembolso integral | Reduz o risco da compra por impulso; estorno já retira o acesso |
| 23/09 | Área do aluno no ar por 90 dias, até 24/12/2026 | Decisão do Guilherme |

## Pendências de produto (do Guilherme, não do executor)

- Preço para equipes (sugestão: R$ 79/acesso a partir de 3, sem anunciar)
- Número de WhatsApp real para a landing/FAQ

## Backlog

1. ~~Esqueleto + Dockerfile + landing no ar~~ — feito na tarefa 01, mergeado na main
2. ~~Login, área do aluno, conteúdo protegido + /admin completo~~ — feito na tarefa 02, mergeado na main (achado da tarefa 03: já estava mergeado, só não tinha sido atualizado aqui)
3. (fundido no item 2)
4. ~~Checkout PIX + tela de QR + polling + webhook + /privacidade~~ — feito nas tarefas 03 e 04, aguardando merge
5. (fundido no item 4) — feito nas tarefas 03 e 04, aguardando merge
6. ~~Preço de lançamento R$ 49,90 numa fonte só, garantia, prazo de acesso e limpeza dos avisos âmbar~~ — feito na tarefa 05, aguardando merge
7. Teste real com R$ 1 e go-live (preço de lançamento até 25/09, depois decidir o preço cheio) + favicon/og-image

### Registro rápido (micro-correções, sem tarefa)

- favicon e og-image inexistentes (achado da tarefa 01) — criar antes da divulgação (Guilherme: arte)
- Ajuste de diagramação mobile (navbar, selo de prazo, preço e link da garantia) na landing, feito na tarefa 07 — aguardando merge
