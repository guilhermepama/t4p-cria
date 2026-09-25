"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const db = require("./db");
const auth = require("./auth");
const mp = require("./mp");
const { render, escapeHtml } = require("./views/render");

const app = express();

app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 2));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
    referrerPolicy: { policy: "same-origin" },
  })
);
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ---------- landing (public/index.html), com o preço trocado no servidor ----------

const INDEX_TEMPLATE = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");

app.get(["/", "/index.html"], (req, res) => {
  const html = INDEX_TEMPLATE.replace(/\{\{preco_brl\}\}/g, precoBRL(precoAtual()))
    .replace(/\{\{selo_texto\}\}/g, seloVendas())
    .replace(/\{\{whatsapp_fmt\}\}/g, whatsappContatoFormatado())
    .replace(
      /\{\{link_garantia\}\}/g,
      linkWhatsapp("Oi! Quero pedir o reembolso do kit IA para Negócios (garantia de 7 dias).")
    )
    .replace(
      /\{\{link_contato\}\}/g,
      linkWhatsapp("Oi! Tenho uma dúvida sobre o kit IA para Negócios.")
    )
    .replace(/\{\{whatsapp\}\}/g, whatsappContatoDigitos());
  res.type("html").send(html);
});

// Pitch interno (sem autenticação, fora da lógica de VENDAS_ATE). Sem cache: o arquivo pode ser trocado até a hora da apresentação.
app.get("/pitch-ambiental-social", (req, res) => {
  res.set({ "X-Robots-Tag": "noindex", "Cache-Control": "no-cache" });
  res.type("text/html; charset=utf-8");
  res.sendFile(path.join(__dirname, "..", "public", "pitch-ambiental-social.html"), { cacheControl: false });
});

// Dados do pitch, lidos do próprio banco a cada abertura. Só agregados (contagens e nota média), sem dados pessoais.
// PITCH_PAGINAS_KIT: páginas dos PDFs entregues (Kit completo 21 + Assistentes prontos 4), contadas com pdfinfo em 25/09/2026.
const PITCH_PAGINAS_KIT = 25;
app.get("/pitch-ambiental-social/dados.json", (req, res) => {
  res.set({ "X-Robots-Tag": "noindex", "Cache-Control": "no-store" });
  const r = db.resumoPitch(AULAS[0].arquivo);
  res.json({
    geradoEm: new Date().toISOString(),
    compradores: r.compradores,
    abriram: r.alunosAtivos > 0 ? Math.round((r.alunosQueAbriram / r.alunosAtivos) * 100) : null,
    concluiram: r.concluiramAula1,
    nota: r.notaMedia == null ? null : Math.round(r.notaMedia * 10) / 10,
    avaliacoes: r.avaliacoes,
    aulas: r.aulasAbertas,
    aulasConcluidas: r.aulasConcluidas,
    paginasKit: PITCH_PAGINAS_KIT,
  });
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (req, res) => {
  res.json({ ok: true, db: db.ping() });
});

// ---------- conteúdo do kit (lista branca) ----------

const CONTEUDO_DIR = path.join(__dirname, "..", "conteudo");

const AULAS = [
  {
    arquivo: "Aula1_O_Pedido_que_Funciona.html",
    titulo: "Aula 1 — O pedido que funciona",
    duracaoMin: 15,
    descricaoCaminho: "Por que a IA responde genérico e como montar um pedido que funciona.",
  },
  {
    arquivo: "Aula2_Conserte_a_Resposta.html",
    titulo: "Aula 2 — Conserte a resposta",
    duracaoMin: 15,
    descricaoCaminho: "O que fazer quando a resposta vem ruim, sem começar do zero.",
  },
  {
    arquivo: "Aula3_Monte_sua_Equipe.html",
    titulo: "Aula 3 — Monte sua equipe",
    duracaoMin: 20,
    descricaoCaminho: "Seu primeiro assistente fixo.",
    destacarManual: true,
  },
];

const DOWNLOADS = [
  { arquivo: "IA_para_Negocios_Kit_Completo.pdf", titulo: "Kit completo (PDF)" },
  { arquivo: "T4P_Assistentes_Prontos.pdf", titulo: "Assistentes prontos (PDF)" },
  { arquivo: "assistente_vendas.txt", titulo: "Assistente de vendas (.txt)" },
  { arquivo: "assistente_marketing.txt", titulo: "Assistente de marketing (.txt)" },
  { arquivo: "assistente_gestao.txt", titulo: "Assistente de gestão (.txt)" },
  { arquivo: "Manual_de_Integracao_da_IA_Template.docx", titulo: "Manual de integração — modelo (.docx)" },
  { arquivo: "Manual_de_Integracao_Exemplo_Lanchonete.docx", titulo: "Manual de integração — exemplo (.docx)" },
];

// ferramentas de uso contínuo: páginas HTML como as aulas, mas sem progresso nem avaliação
const FERRAMENTAS = [
  {
    arquivo: "Ferramenta_Gerador_de_Pedido.html",
    titulo: "Gerador de pedido",
    descricao: "Monte um pedido com o método CAFÉ da Aula 1 e copie para a sua IA. Use sempre que precisar.",
    rotuloBotao: "Abrir gerador",
  },
];

const ARQUIVOS_PERMITIDOS = new Map();
AULAS.forEach((a) => ARQUIVOS_PERMITIDOS.set(a.arquivo, "html"));
FERRAMENTAS.forEach((f) => ARQUIVOS_PERMITIDOS.set(f.arquivo, "html"));
DOWNLOADS.forEach((d) => ARQUIVOS_PERMITIDOS.set(d.arquivo, "download"));

const AULAS_ARQUIVOS = new Set(AULAS.map((a) => a.arquivo));

// título do manual-modelo nas boas-vindas: derivado de DOWNLOADS (sem o "(.docx)") para nunca destoar
const MANUAL_MODELO_TITULO = DOWNLOADS.find(
  (d) => d.arquivo === "Manual_de_Integracao_da_IA_Template.docx"
).titulo.replace(/\s*\(\.\w+\)$/, "");

function passoCaminhoHtml(a) {
  const nota = a.destacarManual
    ? ` Deixe o <em>${escapeHtml(MANUAL_MODELO_TITULO)}</em> aberto ao lado.`
    : "";
  return `      <li><strong>${escapeHtml(a.titulo)}</strong> · uns ${a.duracaoMin} min. ${escapeHtml(
    a.descricaoCaminho
  )}${nota}</li>`;
}

const CAMINHO_AULAS_HTML = AULAS.map(passoCaminhoHtml).join("\n");

// ---------- helpers de formatação ----------

function formatarBRT(textoUtc) {
  if (!textoUtc) return "—";
  const data = new Date(textoUtc.replace(" ", "T") + "Z");
  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function precoBRL(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarBRL(valor) {
  return `R$ ${precoBRL(valor)}`;
}

function paraIsoUtc(textoUtc) {
  return textoUtc.replace(" ", "T") + "Z";
}

function precoAtual() {
  return Number(process.env.PRECO || 49.9);
}

function limparWhatsapp(valor) {
  return String(valor || "").replace(/\D/g, "");
}

const WHATSAPP_PADRAO = "5519974139426";

function whatsappContatoDigitos() {
  return limparWhatsapp(process.env.WHATSAPP) || WHATSAPP_PADRAO;
}

function whatsappContatoFormatado() {
  const digitos = whatsappContatoDigitos();
  const semDdi = digitos.startsWith("55") && digitos.length > 11 ? digitos.slice(2) : digitos;
  const ddd = semDdi.slice(0, 2);
  const numero = semDdi.slice(2);
  if (numero.length === 9) return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
  if (numero.length === 8) return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
  return digitos;
}

function linkWhatsapp(mensagem) {
  return `https://wa.me/${whatsappContatoDigitos()}?text=${encodeURIComponent(mensagem)}`;
}

const VENDAS_ATE_PADRAO = "2026-09-25T14:00:00-03:00";

function vendasAte() {
  return process.env.VENDAS_ATE || VENDAS_ATE_PADRAO;
}

function vendasEncerradas() {
  return Date.now() >= new Date(vendasAte()).getTime();
}

function seloVendas() {
  return vendasEncerradas() ? "Vendas encerradas" : "Preço de lançamento — só até sexta, 25/09, às 14h";
}

function renderVendasEncerradas(res) {
  return res.status(410).send(
    render("vendas-encerradas.html", {
      linkWhatsapp: linkWhatsapp("Oi! Vi que as vendas do kit IA para Negócios encerraram."),
    })
  );
}

function normalizarValor(valor) {
  return Number(String(valor ?? "").trim().replace(",", "."));
}

function protegerCsv(valor) {
  const texto = String(valor ?? "");
  return /^[=+\-@\t\r]/.test(texto) ? "'" + texto : texto;
}

// ---------- checkout / pagamento PIX ----------

const ultimaConsultaPorPedido = new Map();

async function processarPagamento(paymentId, origem) {
  let pagamento;
  try {
    pagamento = await mp.consultarPagamento(paymentId);
  } catch (erro) {
    db.registrarEvento("mp_erro", `consulta paymentId=${paymentId} origem=${origem}: ${erro.message}`);
    return;
  }

  const externalRef = String(pagamento.external_reference || "");
  if (!externalRef.startsWith("T4P-")) {
    db.registrarEvento("mp_ignorado", `external_reference inválido paymentId=${paymentId} origem=${origem}`);
    return;
  }

  const orderId = Number(externalRef.slice(4));
  const pedido = db.buscarPedidoPorId(orderId);
  if (!pedido) {
    db.registrarEvento("mp_ignorado", `pedido não encontrado id=${orderId} origem=${origem}`);
    return;
  }
  if (pedido.mp_payment_id && String(pedido.mp_payment_id) !== String(paymentId)) {
    db.registrarEvento("mp_ignorado", `mp_payment_id não confere pedido=${orderId} origem=${origem}`);
    return;
  }

  const status = pagamento.status;

  if (status === "approved") {
    if (Number(pagamento.transaction_amount) < Number(pedido.valor)) {
      db.registrarEvento("mp_ignorado", `valor menor que o pedido pedido=${orderId} origem=${origem}`);
      return;
    }
    db.marcarPedidoPago(orderId);
    db.registrarEvento("mp_aprovado", `pedido=${orderId} origem=${origem}`);
    return;
  }

  if (status === "refunded" || status === "charged_back") {
    db.marcarPedidoEstornado(orderId);
    db.registrarEvento("mp_estorno", `pedido=${orderId} status=${status} origem=${origem}`);
    return;
  }

  const expirou = pedido.expira_em && new Date(paraIsoUtc(pedido.expira_em)).getTime() < Date.now();
  if (status === "cancelled" || status === "rejected" || expirou) {
    db.marcarPedidoExpirado(orderId);
    db.registrarEvento("mp_ignorado", `pedido=${orderId} status=${status} origem=${origem}`);
    return;
  }

  if (status === "pending") {
    return;
  }

  db.registrarEvento("mp_ignorado", `pedido=${orderId} status=${status} sem ação origem=${origem}`);
}

async function criarPedidoComPix(usuario) {
  const token = crypto.randomBytes(16).toString("hex");
  const orderId = db.criarPedido(usuario.id, precoAtual(), token);
  const pedido = db.buscarPedidoPorId(orderId);

  try {
    const resultado = await mp.criarPix({ pedido, usuario });
    db.atualizarPedidoPix(orderId, resultado);
  } catch (erro) {
    db.registrarEvento("mp_erro", `criar pix pedido=${orderId}: ${erro.message}`);
    return { ok: false };
  }

  return { ok: true, token };
}

// ---------- /entrar, /sair ----------

const limiteEntrar = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

function linkEsqueciSenha() {
  return linkWhatsapp("Oi! Esqueci minha senha do kit IA para Negócios. Meu e-mail de cadastro é: ");
}

app.get("/entrar", (req, res) => {
  const volta = auth.caminhoRelativoSeguro(req.query.volta) || "/aluno";
  res.send(
    render("entrar.html", {
      volta,
      email: "",
      mensagemErro: "",
      linkEsqueci: linkEsqueciSenha(),
    })
  );
});

app.post("/entrar", limiteEntrar, auth.checarOrigem, (req, res) => {
  const email = String(req.body.email || "").trim();
  const senha = String(req.body.senha || "");
  const volta = auth.caminhoRelativoSeguro(req.body.volta) || "/aluno";

  const usuario = db.buscarUsuarioPorEmail(email);
  const senhaOk = usuario && auth.verificarSenha(senha, usuario.senha_hash);

  if (!usuario || !senhaOk) {
    return res.status(401).send(
      render("entrar.html", {
        volta,
        email,
        mensagemErro: '<p class="erro">E-mail ou senha incorretos.</p>',
        linkEsqueci: linkEsqueciSenha(),
      })
    );
  }

  if (!usuario.ativo) {
    return res.status(403).send(
      render("entrar.html", {
        volta,
        email,
        mensagemErro: `<p class="erro">Seu acesso ainda não foi liberado. Se já pagou, <a href="${linkWhatsapp(
          "Oi! Já paguei o kit e meu acesso não foi liberado."
        )}" target="_blank" rel="noopener">fale com a gente no WhatsApp</a>.</p>`,
        linkEsqueci: linkEsqueciSenha(),
      })
    );
  }

  auth.criarSessaoCookie(res, usuario.id);
  res.redirect(volta);
});

app.post("/sair", auth.checarOrigem, (req, res) => {
  auth.destruirSessaoCookie(req, res);
  res.redirect("/entrar");
});

// ---------- /comprar, /pagamento, /webhooks/mp ----------

const limiteComprar = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

function checkoutDisponivel() {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

app.get("/comprar", (req, res) => {
  if (vendasEncerradas()) {
    return renderVendasEncerradas(res);
  }
  if (!checkoutDisponivel()) {
    return res.status(503).send(
      render("comprar-indisponivel.html", {
        linkWhatsapp: linkWhatsapp("Oi! Quero comprar o kit IA para Negócios por PIX direto."),
      })
    );
  }

  res.send(
    render("comprar.html", {
      preco: precoBRL(precoAtual()),
      nome: "",
      email: "",
      whatsapp: "",
      mensagemErro: "",
    })
  );
});

app.post("/comprar", limiteComprar, auth.checarOrigem, async (req, res) => {
  if (vendasEncerradas()) {
    return renderVendasEncerradas(res);
  }
  if (!checkoutDisponivel()) {
    return res.status(503).send(
      render("comprar-indisponivel.html", {
        linkWhatsapp: linkWhatsapp("Oi! Quero comprar o kit IA para Negócios por PIX direto."),
      })
    );
  }

  const dadosForm = {
    nome: String(req.body.nome || "").trim(),
    email: String(req.body.email || "").trim(),
    whatsapp: String(req.body.whatsapp || "").trim(),
    senha: String(req.body.senha || ""),
    aceite: req.body.aceite,
  };

  const reexibir = (statusCode, mensagemErro) =>
    res.status(statusCode).send(
      render("comprar.html", {
        preco: precoBRL(precoAtual()),
        nome: dadosForm.nome,
        email: dadosForm.email,
        whatsapp: dadosForm.whatsapp,
        mensagemErro: `<p class="erro">${mensagemErro}</p>`,
      })
    );

  const digitosWhatsapp = limparWhatsapp(dadosForm.whatsapp);

  if (!dadosForm.nome || !dadosForm.email) {
    return reexibir(400, "Preencha nome e e-mail.");
  }
  if (digitosWhatsapp.length !== 10 && digitosWhatsapp.length !== 11) {
    return reexibir(400, "Informe um WhatsApp válido, com DDD.");
  }
  if (dadosForm.senha.length < 8) {
    return reexibir(400, "A senha precisa ter ao menos 8 caracteres.");
  }
  if (!dadosForm.aceite) {
    return reexibir(400, 'É preciso aceitar a <a href="/privacidade">política de privacidade</a>.');
  }

  const usuarioExistente = db.buscarUsuarioPorEmail(dadosForm.email);

  if (usuarioExistente && usuarioExistente.ativo) {
    return res.status(409).send(
      render("comprar.html", {
        preco: precoBRL(precoAtual()),
        nome: dadosForm.nome,
        email: dadosForm.email,
        whatsapp: dadosForm.whatsapp,
        mensagemErro: '<p class="erro">Você já tem acesso. <a href="/entrar">Entrar</a>.</p>',
      })
    );
  }

  const senhaHash = auth.hashSenha(dadosForm.senha);
  let usuario;

  if (usuarioExistente) {
    db.atualizarUsuarioParaCompra(usuarioExistente.id, {
      nome: dadosForm.nome,
      whatsapp: digitosWhatsapp,
      senhaHash,
    });
    usuario = db.buscarUsuarioPorId(usuarioExistente.id);
  } else {
    const userId = db.criarUsuarioInativo(dadosForm.nome, dadosForm.email, digitosWhatsapp, senhaHash);
    usuario = db.buscarUsuarioPorId(userId);
  }

  const pedidoReaproveitavel = db.buscarPedidoPendenteValido(usuario.id);
  if (pedidoReaproveitavel) {
    return res.redirect(303, `/pagamento/${pedidoReaproveitavel.token}`);
  }

  const resultado = await criarPedidoComPix(usuario);
  if (!resultado.ok) {
    return reexibir(502, "Não conseguimos gerar o PIX agora. Tente de novo em instantes.");
  }

  res.redirect(303, `/pagamento/${resultado.token}`);
});

app.get("/pagamento/:token", (req, res) => {
  const pedido = db.buscarPedidoPorToken(req.params.token);
  if (!pedido || !pedido.pix_qr_base64) {
    return res.status(404).send("Não encontrado.");
  }

  res.send(
    render("pagamento.html", {
      token: pedido.token,
      tokenJson: JSON.stringify(pedido.token),
      expiraEmJson: JSON.stringify(paraIsoUtc(pedido.expira_em)),
      valorFormatado: formatarBRL(pedido.valor),
      qrBase64: pedido.pix_qr_base64,
      copiaCola: pedido.pix_copia_cola || "",
      erroHtml: req.query.erro
        ? '<p class="erro">Não conseguimos gerar um novo PIX agora. Tente de novo em instantes.</p>'
        : "",
      avisoHtml: req.query.aviso === "valido"
        ? '<p class="aviso">Seu PIX atual ainda está válido. Use o QR abaixo.</p>'
        : "",
      linkWhatsapp: linkWhatsapp("Oi! Fiz o PIX do kit IA para Negócios e o acesso não foi liberado."),
    })
  );
});

app.post("/pagamento/:token/novo", auth.checarOrigem, async (req, res) => {
  if (vendasEncerradas()) {
    return renderVendasEncerradas(res);
  }

  const pedidoAntigo = db.buscarPedidoPorToken(req.params.token);
  if (!pedidoAntigo) return res.status(404).send("Não encontrado.");

  const expirou =
    pedidoAntigo.expira_em && new Date(paraIsoUtc(pedidoAntigo.expira_em)).getTime() < Date.now();
  const podeGerarNovo = pedidoAntigo.status === "expirado" || (pedidoAntigo.status === "pendente" && expirou);

  if (!podeGerarNovo) {
    return res.redirect(303, `/pagamento/${pedidoAntigo.token}?aviso=valido`);
  }

  db.marcarPedidoExpirado(pedidoAntigo.id);

  const usuario = db.buscarUsuarioPorId(pedidoAntigo.user_id);
  const resultado = await criarPedidoComPix(usuario);
  if (!resultado.ok) {
    return res.redirect(303, `/pagamento/${pedidoAntigo.token}?erro=1`);
  }

  res.redirect(303, `/pagamento/${resultado.token}`);
});

app.get("/api/pedido/:token", async (req, res) => {
  const pedido = db.buscarPedidoPorToken(req.params.token);
  if (!pedido) return res.status(404).json({});

  if (pedido.status === "pendente") {
    const expirou = pedido.expira_em && new Date(paraIsoUtc(pedido.expira_em)).getTime() < Date.now();
    if (expirou) {
      db.marcarPedidoExpirado(pedido.id);
      return res.json({ status: "expirado" });
    }

    if (pedido.mp_payment_id) {
      const ultima = ultimaConsultaPorPedido.get(pedido.id) || 0;
      if (Date.now() - ultima > 5000) {
        ultimaConsultaPorPedido.set(pedido.id, Date.now());
        await processarPagamento(pedido.mp_payment_id, "polling");
      }
    }
  }

  const pedidoAtualizado = db.buscarPedidoPorId(pedido.id);
  res.json({ status: pedidoAtualizado.status });
});

app.get("/pagamento/:token/acesso", (req, res) => {
  const pedido = db.buscarPedidoPorToken(req.params.token);
  const pagoRecente =
    pedido &&
    pedido.status === "pago" &&
    !pedido.login_feito &&
    pedido.pago_em &&
    Date.now() - new Date(paraIsoUtc(pedido.pago_em)).getTime() < 2 * 60 * 60 * 1000;

  if (!pagoRecente) {
    return res.redirect("/entrar");
  }

  db.marcarLoginFeito(pedido.id);
  auth.criarSessaoCookie(res, pedido.user_id);
  res.redirect("/aluno");
});

app.post("/webhooks/mp", (req, res) => {
  const dataId = req.query["data.id"] || req.body?.data?.id;
  const tipo = req.query.type || req.body?.type || req.body?.topic;

  if (tipo !== "payment") {
    db.registrarEvento("mp_ignorado", `webhook type=${tipo}`);
    return res.status(200).end();
  }

  const assinaturaValida = mp.validarAssinatura({
    xSignature: req.headers["x-signature"],
    xRequestId: req.headers["x-request-id"],
    dataId,
  });

  if (!assinaturaValida) {
    db.registrarEvento("webhook_assinatura_invalida", `data.id=${dataId}`);
    return res.status(401).end();
  }

  res.status(200).end();

  setImmediate(async () => {
    try {
      await processarPagamento(dataId, "webhook");
    } catch (erro) {
      db.registrarEvento("mp_erro", `webhook paymentId=${dataId} origem=webhook: ${erro.message}`);
    }
  });
});

app.get("/privacidade", (req, res) => {
  res.send(
    render("privacidade.html", {
      whatsappFmt: whatsappContatoFormatado(),
      linkWhatsapp: linkWhatsapp("Oi! Tenho uma dúvida sobre o kit IA para Negócios."),
    })
  );
});

// ---------- área do aluno ----------

function progressoDoAlunoJson(userId) {
  const mapa = db.progressoDoAluno(userId);
  const aulas = {};
  const downloads = {};
  for (const linha of mapa.values()) {
    if (linha.tipo === "aula") {
      aulas[linha.item] = { passo: linha.passo, total: linha.total, concluido: Boolean(linha.concluido) };
    } else {
      downloads[linha.item] = Boolean(linha.concluido);
    }
  }
  const avaliacoes = db.avaliacoesDoAluno(userId);
  const aula1Concluida = Boolean(aulas[AULAS[0].arquivo]?.concluido);
  const aula3Concluida = Boolean(aulas[AULAS[2].arquivo]?.concluido);
  let cartaoAvaliacao = null;
  if (aula3Concluida && !avaliacoes.final) cartaoAvaliacao = "final";
  else if (aula1Concluida && !avaliacoes.intermediaria && !avaliacoes.final) cartaoAvaliacao = "intermediaria";
  return { aulas, downloads, avaliacoes, cartaoAvaliacao };
}

const AVALIACAO_TEXTOS = {
  intermediaria: {
    titulo: "O que você está achando do curso até aqui?",
    rotuloComentario: "Quer contar mais? (opcional)",
    placeholder: "O que ajudou, o que ficou confuso, o que faltou…",
  },
  final: {
    titulo: "Que nota você dá para o curso?",
    rotuloComentario: "O que você já usou ou vai usar no seu negócio? (opcional)",
    placeholder: "Ex.: montei o assistente de vendas e respondi os clientes do WhatsApp com ele",
  },
};

function avaliacaoHtml(etapa, oculto) {
  return render("avaliacao.html", {
    etapa,
    ...AVALIACAO_TEXTOS[etapa],
    atributoHidden: oculto ? " hidden" : "",
  });
}

function cartaoAulaHtml(a, info) {
  let progressoHtml;
  let rotuloBotao = "Abrir aula";

  if (!info) {
    progressoHtml = `<div class="progresso-aula"><span class="texto-progresso">Não iniciada</span></div>`;
  } else if (info.concluido) {
    progressoHtml = `<div class="progresso-aula"><div class="trilho"><div class="preenchido" style="width:100%"></div></div><span class="texto-progresso"><span class="selo-concluida">✓ Concluída</span></span></div>`;
    rotuloBotao = "Rever aula";
  } else {
    const pct = info.total > 0 ? Math.round((info.passo / info.total) * 100) : 0;
    progressoHtml = `<div class="progresso-aula"><div class="trilho"><div class="preenchido" style="width:${pct}%"></div></div><span class="texto-progresso">Passo ${info.passo} de ${info.total}</span></div>`;
  }

  return `
      <div class="card" data-aula="${escapeHtml(a.arquivo)}">
        <h3>${escapeHtml(a.titulo)}</h3>
        ${progressoHtml}
        <a class="btn" href="/aluno/conteudo/${encodeURIComponent(a.arquivo)}" target="_blank" rel="noopener">${rotuloBotao}</a>
      </div>`;
}

function cartaoFerramentaHtml(f) {
  return `
      <div class="card ferramenta" data-ferramenta="${escapeHtml(f.arquivo)}">
        <h3>${escapeHtml(f.titulo)}</h3>
        <p class="descricao-ferramenta">${escapeHtml(f.descricao)}</p>
        <a class="btn" href="/aluno/conteudo/${encodeURIComponent(f.arquivo)}" target="_blank" rel="noopener">${escapeHtml(f.rotuloBotao)}</a>
      </div>`;
}

function linhaDownloadHtml(d, baixado) {
  return `
      <div class="download" data-arquivo="${escapeHtml(d.arquivo)}">
        <span>${escapeHtml(d.titulo)}</span>
        <span class="download-acoes">
          <span class="check-baixado"${baixado ? "" : ' style="display:none"'}>✓ Baixado</span>
          <a class="link-baixar${baixado ? " ja-baixado" : ""}" href="/aluno/conteudo/${encodeURIComponent(d.arquivo)}">${baixado ? "Baixar de novo" : "Baixar"}</a>
        </span>
      </div>`;
}

app.get("/aluno", auth.requireAluno, (req, res) => {
  const progresso = progressoDoAlunoJson(req.aluno.id);
  const iniciouAlguma = Object.keys(progresso.aulas).length > 0;

  const aulasHtml = AULAS.map((a) => cartaoAulaHtml(a, progresso.aulas[a.arquivo])).join("\n");
  const ferramentasHtml = FERRAMENTAS.map(cartaoFerramentaHtml).join("\n");
  const downloadsHtml = DOWNLOADS.map((d) => linhaDownloadHtml(d, Boolean(progresso.downloads[d.arquivo]))).join(
    "\n"
  );

  res.send(
    render("aluno.html", {
      nome: req.aluno.nome,
      aulasHtml,
      ferramentasHtml,
      downloadsHtml,
      cartaoIntermediariaHtml: avaliacaoHtml("intermediaria", progresso.cartaoAvaliacao !== "intermediaria"),
      cartaoFinalHtml: avaliacaoHtml("final", progresso.cartaoAvaliacao !== "final"),
      caminhoAulasHtml: CAMINHO_AULAS_HTML,
      boasVindasAberto: iniciouAlguma ? "" : "open",
      resumoBoasVindas: iniciouAlguma ? "Como funciona o curso" : "Comece por aqui",
      linkWhatsappAulas: linkWhatsapp("Oi! Travei numa aula do kit IA para Negócios."),
      whatsappFmt: whatsappContatoFormatado(),
      linkWhatsapp: linkWhatsapp("Oi! Tenho uma dúvida sobre o kit IA para Negócios."),
    })
  );
});

// ---------- /aluno/senha: o aluno troca a própria senha ----------

const limiteSenha = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `senha:${req.aluno.id}`,
});

const SENHA_MIN = 8;
const SENHA_MAX = 200;

function renderSenha(res, { statusCode = 200, erro = "", ok = "" } = {}) {
  res.status(statusCode).set("Cache-Control", "private, no-store").send(
    render("senha.html", {
      mensagemErro: erro ? `<p class="erro" role="alert">${escapeHtml(erro)}</p>` : "",
      mensagemOk: ok ? `<p class="ok" role="status">${escapeHtml(ok)}</p>` : "",
      linkWhatsapp: linkWhatsapp("Oi! Preciso de ajuda para trocar a senha do kit IA para Negócios."),
    })
  );
}

app.get("/aluno/senha", auth.requireAluno, (req, res) => {
  renderSenha(res);
});

app.post("/aluno/senha", auth.requireAluno, auth.checarOrigem, limiteSenha, (req, res) => {
  const atual = String(req.body.senhaAtual || "");
  const nova = String(req.body.senhaNova || "");
  const confirmacao = String(req.body.senhaConfirmacao || "");

  if (atual.length > SENHA_MAX || !auth.verificarSenha(atual, req.aluno.senha_hash)) {
    return renderSenha(res, { statusCode: 400, erro: "A senha atual está incorreta." });
  }
  if (nova.length < SENHA_MIN) {
    return renderSenha(res, { statusCode: 400, erro: `A nova senha precisa ter ao menos ${SENHA_MIN} caracteres.` });
  }
  if (nova.length > SENHA_MAX) {
    return renderSenha(res, { statusCode: 400, erro: `A nova senha pode ter no máximo ${SENHA_MAX} caracteres.` });
  }
  if (nova !== confirmacao) {
    return renderSenha(res, { statusCode: 400, erro: "A confirmação não é igual à nova senha." });
  }
  if (nova === atual) {
    return renderSenha(res, { statusCode: 400, erro: "A nova senha precisa ser diferente da atual." });
  }

  db.trocarSenhaMantendoSessao(req.aluno.id, auth.hashSenha(nova), auth.tokenHashDaSessao(req));
  db.registrarEvento("aluno_trocou_senha", `user_id=${req.aluno.id}`);
  renderSenha(res, { ok: "Senha alterada. Nos outros dispositivos, você precisará entrar de novo." });
});

app.get("/aluno/progresso.json", auth.requireAluno, (req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.json(progressoDoAlunoJson(req.aluno.id));
});

const limiteProgresso = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `progresso:${req.aluno.id}`,
});

app.post("/aluno/progresso", auth.requireAluno, auth.checarOrigem, limiteProgresso, (req, res) => {
  const aula = String(req.body?.aula || "");
  const passo = Number(req.body?.passo);
  const total = Number(req.body?.total);

  if (!AULAS_ARQUIVOS.has(aula)) return res.status(400).end();
  if (!Number.isInteger(passo) || !Number.isInteger(total)) return res.status(400).end();
  if (passo < 0 || total > 30 || passo > total) return res.status(400).end();

  db.registrarPassoAula(req.aluno.id, aula, passo, total);
  res.status(204).end();
});

const limiteAvaliacao = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `avaliacao:${req.aluno.id}`,
});

app.post("/aluno/avaliacao", auth.requireAluno, auth.checarOrigem, limiteAvaliacao, (req, res) => {
  const { etapa, nota, comentario, podeDivulgar } = req.body || {};

  if (etapa !== "intermediaria" && etapa !== "final") return res.status(400).end();
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) return res.status(400).end();
  if (comentario !== undefined && comentario !== null && typeof comentario !== "string") {
    return res.status(400).end();
  }
  if (podeDivulgar !== undefined && typeof podeDivulgar !== "boolean") return res.status(400).end();

  const texto = (comentario || "").trim();
  if (texto.length > 1000) return res.status(400).end();

  db.salvarAvaliacao(req.aluno.id, etapa, nota, texto, podeDivulgar === true);
  res.status(204).end();
});

app.get("/aluno/conteudo/:arquivo", auth.requireAluno, (req, res) => {
  const arquivo = req.params.arquivo;
  const tipo = ARQUIVOS_PERMITIDOS.get(arquivo);
  if (!tipo) return res.status(404).send("Não encontrado.");

  res.set("Cache-Control", "private, no-store");

  if (tipo === "html") {
    return res.sendFile(arquivo, { root: CONTEUDO_DIR, cacheControl: false });
  }

  db.registrarDownload(req.aluno.id, arquivo);
  return res.download(arquivo, arquivo, { root: CONTEUDO_DIR, cacheControl: false });
});

// ---------- /admin ----------

const ETAPAS_ROTULO = {
  intermediaria: "Aula 1 (intermediária)",
  final: "Aula 3 (final)",
};

function blocoAvaliacoesAdmin(opcoes) {
  const resumo = db.resumoAvaliacoes(opcoes);
  const linhasResumo = Object.keys(ETAPAS_ROTULO)
    .map((etapa) => {
      const r = resumo[etapa];
      const media = r.media == null ? "—" : r.media.toFixed(1).replace(".", ",");
      const dist = [1, 2, 3, 4, 5].map((n) => `${n}:${r.distribuicao[n]}`).join(" · ");
      return `<tr><td>${escapeHtml(ETAPAS_ROTULO[etapa])}</td><td>${r.respostas}</td><td>${media}</td><td>${dist}</td></tr>`;
    })
    .join("\n");

  const comentarios = db.listarAvaliacoes(opcoes).filter((a) => a.comentario);
  const linhasComentarios = comentarios.length
    ? comentarios
        .map(
          (a) => `<tr>
      <td>${escapeHtml(formatarBRT(a.atualizado_em))}</td>
      <td>${escapeHtml(ETAPAS_ROTULO[a.etapa] || a.etapa)}</td>
      <td>${a.nota}</td>
      <td>${escapeHtml(a.nome)}</td>
      <td>${escapeHtml(a.comentario)}${a.pode_divulgar ? ' <span class="status-pago">✓ pode divulgar</span>' : ""}</td>
    </tr>`
        )
        .join("\n")
    : '<tr><td colspan="5">Nenhum comentário ainda.</td></tr>';

  return `<h2>Avaliações</h2>
    <table>
      <thead>
        <tr><th>Etapa</th><th>Respostas</th><th>Média</th><th>Notas 1–5</th></tr>
      </thead>
      <tbody>
        ${linhasResumo}
      </tbody>
    </table>
    <table style="margin-top:18px">
      <thead>
        <tr><th>Data</th><th>Etapa</th><th>Nota</th><th>Nome</th><th>Comentário</th></tr>
      </thead>
      <tbody>
        ${linhasComentarios}
      </tbody>
    </table>
    <p style="margin-top:14px"><a class="csv" href="/admin/avaliacoes.csv">Baixar avaliações (CSV)</a></p>`;
}

function renderAdmin(res, { statusCode = 200, mensagemErro = "", incluirTestes = false } = {}) {
  const opcoes = { incluirTestes };
  const resumo = db.resumoVendas(opcoes);
  const alunos = db.listarAlunosComPedidos(opcoes);
  const eventos = db.listarEventosRecentes(50);

  const linhasAlunos = alunos.length
    ? alunos
        .map((linha) => {
          const status = linha.status || "sem pedido";
          const statusTexto =
            status === "pendente" && linha.expira_em
              ? `pendente (expira ${formatarBRT(linha.expira_em)})`
              : status;
          const acoes = [];
          if (!linha.ativo) {
            acoes.push(
              `<form class="acao" method="POST" action="/admin/ativar/${linha.user_id}"><button class="btn-mini" type="submit">Ativar</button></form>`
            );
          }
          acoes.push(`
            <form class="acao" method="POST" action="/admin/senha/${linha.user_id}" style="display:inline-flex;gap:4px;align-items:center">
              <input type="text" name="senha" placeholder="nova senha" minlength="8" required style="width:110px;padding:4px 8px;font-size:12px;border-radius:6px;border:1px solid #232329;background:#0f0f12;color:#f2ede4">
              <button class="btn-mini" type="submit">Nova senha</button>
            </form>`);
          return `<tr>
            <td>${escapeHtml(linha.nome)}</td>
            <td>${escapeHtml(linha.email)}</td>
            <td>${escapeHtml(linha.whatsapp || "—")}</td>
            <td class="status-${escapeHtml(status)}">${escapeHtml(statusTexto)}</td>
            <td>${linha.valor != null ? escapeHtml(formatarBRL(linha.valor)) : "—"}</td>
            <td>${escapeHtml(formatarBRT(linha.criado_em))}</td>
            <td>${acoes.join(" ")}</td>
          </tr>`;
        })
        .join("\n")
    : '<tr><td colspan="7">Nenhum aluno cadastrado ainda.</td></tr>';

  const linhasEventos = eventos.length
    ? eventos
        .map(
          (e) =>
            `<div>${escapeHtml(formatarBRT(e.criado_em))} — ${escapeHtml(e.tipo)}${e.detalhe ? ": " + escapeHtml(e.detalhe) : ""}</div>`
        )
        .join("\n")
    : "<div>Nenhum evento registrado ainda.</div>";

  const alunosAtivos = db.contarAlunosAtivos(opcoes);
  const resumoPorItem = new Map(db.resumoProgresso(opcoes).map((r) => [r.item, r]));

  function linhaUso(item, titulo, tipo) {
    const r = resumoPorItem.get(item);
    const alunosCount = r ? r.alunos : 0;
    const pct = alunosAtivos > 0 ? Math.round((alunosCount / alunosAtivos) * 100) : 0;
    const concluiramTexto = tipo === "aula" ? String(r ? r.concluidos : 0) : "—";
    return `<tr>
      <td>${escapeHtml(titulo)}</td>
      <td>${alunosCount}</td>
      <td>${concluiramTexto}</td>
      <td>${pct}%</td>
    </tr>`;
  }

  const linhasUsoConteudo = [
    ...AULAS.map((a) => linhaUso(a.arquivo, a.titulo, "aula")),
    ...DOWNLOADS.map((d) => linhaUso(d.arquivo, d.titulo, "download")),
  ].join("\n");

  res.status(statusCode).send(
    render("admin.html", {
      blocoAvaliacoes: blocoAvaliacoesAdmin(opcoes),
      mensagemErro: mensagemErro ? `<p class="erro">${escapeHtml(mensagemErro)}</p>` : "",
      totalPagos: String(resumo.total_pagos),
      somaFormatada: formatarBRL(resumo.soma),
      pendentes: String(resumo.pendentes),
      linhasAlunos,
      linhasEventos,
      linhasUsoConteudo,
      preco: precoAtual().toFixed(2),
      linkTestes: incluirTestes
        ? '<a class="csv" href="/admin">Ocultar registros de teste</a>'
        : '<a class="csv" href="/admin?testes=1">Mostrar registros de teste</a>',
    })
  );
}

app.get("/admin", auth.requireAdmin, (req, res) => {
  renderAdmin(res, { incluirTestes: req.query.testes === "1" });
});

app.post("/admin/alunos", auth.requireAdmin, auth.checarOrigem, (req, res) => {
  const nome = String(req.body.nome || "").trim();
  const email = String(req.body.email || "").trim();
  const whatsapp = String(req.body.whatsapp || "").trim() || null;
  const senha = String(req.body.senha || "");
  const valor = normalizarValor(req.body.valor || precoAtual());

  if (!nome || !email || senha.length < 8 || !Number.isFinite(valor) || valor <= 0) {
    return renderAdmin(res, { statusCode: 400, mensagemErro: "Dados inválidos para cadastro." });
  }

  try {
    db.criarAlunoManual({ nome, email, whatsapp, senhaHash: auth.hashSenha(senha), valor });
  } catch (erro) {
    if (String(erro.message).includes("UNIQUE")) {
      return renderAdmin(res, { statusCode: 409, mensagemErro: "Já existe um aluno com este e-mail." });
    }
    throw erro;
  }

  db.registrarEvento("admin_cadastro_manual", `email=${email}`);
  res.redirect("/admin");
});

app.post("/admin/ativar/:userId", auth.requireAdmin, auth.checarOrigem, (req, res) => {
  const usuario = db.buscarUsuarioPorId(req.params.userId);
  if (!usuario) return renderAdmin(res, { statusCode: 404, mensagemErro: "Aluno não encontrado." });

  db.ativarAluno(usuario.id, precoAtual());
  db.registrarEvento("admin_ativacao", `user_id=${usuario.id}`);
  res.redirect("/admin");
});

app.post("/admin/senha/:userId", auth.requireAdmin, auth.checarOrigem, (req, res) => {
  const usuario = db.buscarUsuarioPorId(req.params.userId);
  if (!usuario) return renderAdmin(res, { statusCode: 404, mensagemErro: "Aluno não encontrado." });

  const senha = String(req.body.senha || "");
  if (senha.length < 8) {
    return renderAdmin(res, { statusCode: 400, mensagemErro: "A senha precisa ter ao menos 8 caracteres." });
  }

  db.trocarSenha(usuario.id, auth.hashSenha(senha));
  db.registrarEvento("admin_nova_senha", `user_id=${usuario.id}`);
  res.redirect("/admin");
});

app.get("/admin/vendas.csv", auth.requireAdmin, (req, res) => {
  const linhas = db.listarAlunosComPedidos();
  const cabecalho = "pedido;nome;email;whatsapp;valor;status;pago_em";
  const corpo = linhas
    .map((l) =>
      [
        l.order_id ?? "",
        protegerCsv(l.nome),
        protegerCsv(l.email),
        protegerCsv(l.whatsapp || ""),
        l.valor != null ? String(l.valor).replace(".", ",") : "",
        l.status || "",
        l.pago_em ? formatarBRT(l.pago_em) : "",
      ]
        .map((campo) => `"${String(campo).replace(/"/g, '""')}"`)
        .join(";")
    )
    .join("\r\n");

  const csv = "﻿" + cabecalho + "\r\n" + corpo + "\r\n";
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", 'attachment; filename="vendas.csv"');
  res.send(csv);
});

app.get("/admin/avaliacoes.csv", auth.requireAdmin, (req, res) => {
  const cabecalho = "data;etapa;nota;nome;email;comentario;pode_divulgar";
  const corpo = db
    .listarAvaliacoes()
    .map((a) =>
      [
        formatarBRT(a.atualizado_em),
        a.etapa,
        a.nota,
        protegerCsv(a.nome),
        protegerCsv(a.email),
        protegerCsv(a.comentario),
        a.pode_divulgar ? "sim" : "não",
      ]
        .map((campo) => `"${String(campo).replace(/"/g, '""')}"`)
        .join(";")
    )
    .join("\r\n");

  const csv = "﻿" + cabecalho + "\r\n" + (corpo ? corpo + "\r\n" : "");
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", 'attachment; filename="avaliacoes.csv"');
  res.send(csv);
});

app.use((req, res) => {
  res.status(404).send("Não encontrado.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`t4p-app ouvindo na porta ${PORT}`);
});
