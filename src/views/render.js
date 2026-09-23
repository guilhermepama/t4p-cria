"use strict";

const fs = require("fs");
const path = require("path");

const ENTIDADES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ENTIDADES[c]);
}

function render(nomeArquivo, dados = {}) {
  const caminho = path.join(__dirname, nomeArquivo);
  const template = fs.readFileSync(caminho, "utf8");
  return template.replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}/g, (match, chaveRaw, chaveEscapada) => {
    if (chaveRaw) return dados[chaveRaw] ?? "";
    return escapeHtml(dados[chaveEscapada]);
  });
}

module.exports = { render, escapeHtml };
