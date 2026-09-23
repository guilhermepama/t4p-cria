"use strict";

// Servidor falso do Mercado Pago, para validar o checkout PIX sem credenciais reais.
// Uso: node scripts/mp-fake.js [porta]
// Rotas: POST /v1/payments, GET /v1/payments/:id, POST /__set/:id {status, transaction_amount}

const http = require("http");
const crypto = require("crypto");

const QR_PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const pagamentos = new Map();
let proximoId = 1000;

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let bruto = "";
    req.on("data", (pedaco) => (bruto += pedaco));
    req.on("end", () => {
      if (!bruto) return resolve({});
      try {
        resolve(JSON.parse(bruto));
      } catch (erro) {
        reject(erro);
      }
    });
    req.on("error", reject);
  });
}

function responderJson(res, statusCode, dados) {
  const corpo = JSON.stringify(dados);
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(corpo);
}

function assinarWebhook({ dataId, requestId, secret, ts }) {
  const timestamp = ts || Math.floor(Date.now() / 1000);
  const idTexto = String(dataId);
  const idNormalizado = /^[a-zA-Z0-9]+$/.test(idTexto) ? idTexto.toLowerCase() : idTexto;
  const manifesto = `id:${idNormalizado};request-id:${requestId || ""};ts:${timestamp};`;
  const v1 = crypto.createHmac("sha256", secret).update(manifesto).digest("hex");
  return { ts: timestamp, v1, xSignature: `ts=${timestamp},v1=${v1}` };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  try {
    if (req.method === "POST" && url.pathname === "/v1/payments") {
      const corpo = await lerCorpo(req);
      const id = String(proximoId++);
      const pagamento = {
        id,
        status: "pending",
        transaction_amount: corpo.transaction_amount,
        external_reference: corpo.external_reference,
        date_of_expiration: corpo.date_of_expiration,
        point_of_interaction: {
          transaction_data: {
            qr_code: `00020126PIXFAKE${id}`,
            qr_code_base64: QR_PNG_1X1_BASE64,
          },
        },
      };
      pagamentos.set(id, pagamento);
      return responderJson(res, 201, pagamento);
    }

    const matchConsulta = url.pathname.match(/^\/v1\/payments\/([^/]+)$/);
    if (req.method === "GET" && matchConsulta) {
      const pagamento = pagamentos.get(matchConsulta[1]);
      if (!pagamento) return responderJson(res, 404, { message: "not found" });
      return responderJson(res, 200, pagamento);
    }

    const matchSet = url.pathname.match(/^\/__set\/([^/]+)$/);
    if (req.method === "POST" && matchSet) {
      const pagamento = pagamentos.get(matchSet[1]);
      if (!pagamento) return responderJson(res, 404, { message: "not found" });
      const corpo = await lerCorpo(req);
      if (corpo.status) pagamento.status = corpo.status;
      if (corpo.transaction_amount != null) pagamento.transaction_amount = corpo.transaction_amount;
      return responderJson(res, 200, pagamento);
    }

    responderJson(res, 404, { message: "rota desconhecida" });
  } catch (erro) {
    responderJson(res, 400, { message: String(erro.message || erro) });
  }
});

if (require.main === module) {
  const porta = Number(process.argv[2] || process.env.MP_FAKE_PORT || 3333);
  server.listen(porta, () => {
    console.log(`mp-fake ouvindo na porta ${porta}`);
  });
}

module.exports = { server, assinarWebhook };
