"use strict";

const crypto = require("crypto");

// Alfabeto sem caracteres ambíguos na impressão (0/O, 1/I/L, 5/S, 8/B, 2/Z).
const ALFABETO = "ACDEFGHJKMNPQRTUVWXY34679";
const PREFIXO_PADRAO = "FATEC";

// Formato impresso: PREFIXO-XXXX-XXXX (8 caracteres aleatórios → 25^8 ≈ 1,5e11 combinações).
function gerarCodigo(prefixo = PREFIXO_PADRAO) {
  const bytes = crypto.randomBytes(8);
  let corpo = "";
  for (const b of bytes) corpo += ALFABETO[b % ALFABETO.length];
  return `${normalizarPrefixo(prefixo)}-${corpo.slice(0, 4)}-${corpo.slice(4, 8)}`;
}

function normalizarPrefixo(prefixo) {
  return String(prefixo || PREFIXO_PADRAO)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || PREFIXO_PADRAO;
}

// Aceita o que o aluno digitar: minúsculas, espaços, hífens trocados, O no lugar de 0 etc.
function normalizarCodigo(entrada) {
  const limpo = String(entrada || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!limpo) return "";
  const m = limpo.match(/^([A-Z0-9]*?)([A-Z0-9]{8})$/);
  if (!m || !m[1]) return limpo;
  return `${m[1]}-${m[2].slice(0, 4)}-${m[2].slice(4, 8)}`;
}

// "2026-11-30" (data em Brasília, inclusive) → "2026-12-01 02:59:59" (UTC, formato do banco).
function fimDoDiaBrtParaUtc(dataIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataIso || ""))) return null;
  const fim = new Date(`${dataIso}T23:59:59-03:00`);
  if (Number.isNaN(fim.getTime())) return null;
  return fim.toISOString().slice(0, 19).replace("T", " ");
}

module.exports = { gerarCodigo, normalizarCodigo, normalizarPrefixo, fimDoDiaBrtParaUtc, PREFIXO_PADRAO };
