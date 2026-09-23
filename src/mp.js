"use strict";

const crypto = require("crypto");

const TIMEOUT_MS = 10000;

function baseUrl() {
  return process.env.MP_API_URL || "https://api.mercadopago.com";
}

function cabecalhosAuth() {
  return {
    Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN || ""}`,
    "Content-Type": "application/json",
  };
}

function dataExpiracao(minutos) {
  const alvoUtc = new Date(Date.now() + minutos * 60 * 1000);
  const comOffset = new Date(alvoUtc.getTime() - 3 * 60 * 60 * 1000);
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  const yyyy = comOffset.getUTCFullYear();
  const mm = pad(comOffset.getUTCMonth() + 1);
  const dd = pad(comOffset.getUTCDate());
  const hh = pad(comOffset.getUTCHours());
  const mi = pad(comOffset.getUTCMinutes());
  const ss = pad(comOffset.getUTCSeconds());
  const ms = pad(comOffset.getUTCMilliseconds(), 3);
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.${ms}-03:00`;
}

async function criarPix({ pedido, usuario }) {
  const corpo = {
    transaction_amount: Number(pedido.valor),
    description: "T4P · IA para Negócios",
    payment_method_id: "pix",
    external_reference: `T4P-${pedido.id}`,
    date_of_expiration: dataExpiracao(30),
    payer: { email: usuario.email, first_name: usuario.nome },
  };

  const resp = await fetch(`${baseUrl()}/v1/payments`, {
    method: "POST",
    headers: {
      ...cabecalhosAuth(),
      "X-Idempotency-Key": `T4P-${pedido.token}`,
    },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!resp.ok) {
    throw new Error(`mp_criar_pix_status_${resp.status}`);
  }

  const dados = await resp.json();
  return {
    mpPaymentId: String(dados.id),
    qrBase64: dados.point_of_interaction?.transaction_data?.qr_code_base64 || "",
    copiaCola: dados.point_of_interaction?.transaction_data?.qr_code || "",
  };
}

async function consultarPagamento(id) {
  const resp = await fetch(`${baseUrl()}/v1/payments/${encodeURIComponent(id)}`, {
    headers: cabecalhosAuth(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!resp.ok) {
    throw new Error(`mp_consultar_pagamento_status_${resp.status}`);
  }

  return resp.json();
}

function validarAssinatura({ xSignature, xRequestId, dataId }) {
  const segredo = process.env.MP_WEBHOOK_SECRET || "";
  if (!segredo) return false;
  if (!xSignature || !dataId) return false;

  const partes = {};
  for (const par of String(xSignature).split(",")) {
    const idx = par.indexOf("=");
    if (idx < 0) continue;
    partes[par.slice(0, idx).trim()] = par.slice(idx + 1).trim();
  }
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  const idTexto = String(dataId);
  const idNormalizado = /^[a-zA-Z0-9]+$/.test(idTexto) ? idTexto.toLowerCase() : idTexto;
  const manifesto = `id:${idNormalizado};request-id:${xRequestId || ""};ts:${ts};`;
  const esperadoHex = crypto.createHmac("sha256", segredo).update(manifesto).digest("hex");

  const bufEsperado = Buffer.from(esperadoHex, "hex");
  let bufRecebido;
  try {
    bufRecebido = Buffer.from(v1, "hex");
  } catch {
    return false;
  }
  if (bufEsperado.length !== bufRecebido.length) {
    crypto.timingSafeEqual(bufEsperado, bufEsperado);
    return false;
  }
  return crypto.timingSafeEqual(bufEsperado, bufRecebido);
}

module.exports = {
  criarPix,
  consultarPagamento,
  validarAssinatura,
};
