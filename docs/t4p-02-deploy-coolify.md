# t4p-02 · Deploy em produção (Coolify + GoDaddy + Mercado Pago)

Tarefas do **Guilherme**: o executor não tem acesso a painéis.

## 1. DNS (registro na GoDaddy, DNS no Cloudflare) — FEITO em 23/09

- Nameservers na GoDaddy: `glen.ns.cloudflare.com` e `reza.ns.cloudflare.com`.
- Cloudflare: `A @ → 187.77.254.188` e `CNAME www → iadojeitocerto.com`, os dois **proxied** (nuvem laranja), SSL **Full**. Always Use HTTPS desligado.
- A VPS é compartilhada com o Orbinote e tem o firewall `orbinote-cloudflare-only`: só entra tráfego do Cloudflare. Por isso a nuvem cinza não funciona aqui.
- Pendente: trocar para **Full (strict)** depois de confirmar que o certificado do Let's Encrypt foi emitido no Traefik.

### (histórico) instruções originais

| Tipo | Nome | Valor | TTL |
|---|---|---|---|
| A | @ | IP da VPS Hostinger | 600 |
| CNAME | www | iadojeitocerto.com | 1 h |

- Apague o registro A de "Parked"/"WebsiteBuilder" que vem por padrão.
- Conferir a propagação: `nslookup iadojeitocerto.com` deve devolver o IP da VPS.

## 2. Mercado Pago (mesma conta do Orbinote)

1. mercadopago.com.br/developers → Suas integrações → **Criar aplicação** → nome "T4P", tipo Pagamentos online / CheckoutAPI.
2. Credenciais de produção → copiar o **Access Token** (`APP_USR-…`) → `MP_ACCESS_TOKEN`.
3. Webhooks → modo produção → URL `https://iadojeitocerto.com/webhooks/mp` → evento **Pagamentos** → salvar → copiar a **assinatura secreta** → `MP_WEBHOOK_SECRET`.
4. Não mexa na aplicação do Orbinote.

## 3. GitHub

- Criar o repo **privado** `t4p-app`. Primeiro push a partir desta pasta:
  ```bash
  git remote add origin git@github.com:<usuario>/t4p-app.git
  git push -u origin main
  ```
- No Coolify: Sources → GitHub App com acesso ao repo `t4p-app`.

## 4. Coolify

1. New Resource → Private Repository (GitHub App) → `t4p-app`, branch `main`.
2. Build Pack: **Dockerfile**. Porta: **3000**.
3. Domains: `https://iadojeitocerto.com,https://www.iadojeitocerto.com` (o Traefik emite o Let's Encrypt sozinho).
4. **Storages → Add Volume:** destino `/app/data`. ⚠️ Fazer ANTES da primeira venda; sem ele, cada deploy apaga o banco.
5. Environment Variables: todas do `.env.example`. `ADMIN_USER`/`ADMIN_PASS` são obrigatórias (sem elas o /admin responde 503).
6. Health check: path `/health`.
7. Auto Deploy ligado (deploy a cada push/merge na `main`).
8. Testar a persistência: criar um aluno → Redeploy → o aluno continua lá.

## 5. Teste real (antes de divulgar)

1. `PRECO=1.00` → Redeploy.
2. Comprar pelo celular com um e-mail seu → pagar o PIX.
3. Esperar a liberação em < 10 s e conferir o evento de webhook "assinatura válida" no /admin.
4. Estornar o R$ 1 no painel do MP.
5. `PRECO=97.00` → Redeploy → fazer uma compra até a tela do QR e conferir o valor (sem pagar).
