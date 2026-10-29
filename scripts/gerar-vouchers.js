"use strict";

// Gera códigos de voucher, grava no banco (DB_PATH) e salva um CSV para alimentar a impressão.
//
// Uso:
//   npm run gerar-vouchers -- --lote "Conexão Fatec 2026" --quantidade 30 --validade 2026-11-30 [--prefixo FATEC] [--saida vouchers.csv]
//
// Em produção, rode no terminal do container (Coolify) para os códigos nascerem no banco de produção;
// ou gere localmente e depois cole os códigos em /admin → "Importar códigos já impressos".

const fs = require("fs");
const path = require("path");
const db = require("../src/db");
const vouchers = require("../src/vouchers");

function argumento(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

const lote = String(argumento("lote", "")).trim();
const quantidade = Number.parseInt(argumento("quantidade", "0"), 10);
const prefixo = vouchers.normalizarPrefixo(argumento("prefixo", vouchers.PREFIXO_PADRAO));
const validadeBrt = String(argumento("validade", "")).trim();
const validoAte = vouchers.fimDoDiaBrtParaUtc(validadeBrt);
const saida = path.resolve(argumento("saida", `vouchers-${validadeBrt || "sem-data"}.csv`));

if (!lote || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 500 || !validoAte) {
  console.error(
    'Uso: npm run gerar-vouchers -- --lote "Nome do lote" --quantidade 30 --validade AAAA-MM-DD [--prefixo FATEC] [--saida arquivo.csv]'
  );
  process.exit(1);
}

const codigos = new Set();
while (codigos.size < quantidade) {
  const codigo = vouchers.gerarCodigo(prefixo);
  if (!db.buscarVoucher(codigo)) codigos.add(codigo);
}

db.criarVouchers([...codigos], lote, validoAte);
db.registrarEvento("vouchers_gerados", `script lote=${lote} quantidade=${quantidade} valido_ate=${validoAte}`);

const linhas = ["numero;codigo;lote;valido_ate_brt"];
let n = 0;
for (const codigo of codigos) {
  n += 1;
  linhas.push(`${String(n).padStart(2, "0")};${codigo};${lote.replace(/;/g, ",")};${validadeBrt}`);
}
fs.writeFileSync(saida, "﻿" + linhas.join("\r\n") + "\r\n", "utf8");

console.log(`${quantidade} vouchers gravados no banco (${process.env.DB_PATH || "data/t4p.db"}), lote "${lote}", válidos até ${validadeBrt}.`);
console.log(`CSV: ${saida}`);
