"use strict";

// Testa o fluxo completo num navegador real (Chromium), clicando nos
// formulários de verdade — sem page.request e sem cabeçalhos montados à
// mão. É este teste que teria pego o bug do "Origin: null" (curl não pega,
// porque curl não aplica Referrer-Policy).
//
// Uso: npm run e2e

const path = require("path");
const os = require("os");
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");
const { chromium } = require("playwright");
const mpFake = require("./mp-fake");

const RAIZ = path.join(__dirname, "..");

const ADMIN_USER = "admin-e2e";
const ADMIN_PASS = "senha-admin-e2e-12345";
const PRECO = "49.90";
const PRECO_BRL = "49,90";
const PRECO_NUM = 49.9;
const SUFIXO = Date.now();
const ALUNO_MANUAL = {
  nome: "Aluno Manual E2E",
  email: `aluno.manual.${SUFIXO}@exemplo.com`,
  whatsapp: "11999990001",
  senha: "senha-aluno-e2e",
  valor: "49,90",
};
const ALUNO_PIX = {
  nome: "Aluno Pix E2E",
  email: `aluno.pix.${SUFIXO}@exemplo.com`,
  whatsapp: "11999990002",
  senha: "senha-pix-e2e-1234",
};

const passos = [];
let falhou = false;

async function passo(nome, fn) {
  try {
    await fn();
    passos.push({ nome, ok: true });
    console.log(`✅ ${nome}`);
  } catch (erro) {
    falhou = true;
    passos.push({ nome, ok: false, erro });
    console.log(`❌ ${nome}`);
    console.log(`   ${erro.stack || erro.message || erro}`);
  }
}

function portaLivre(preferida) {
  return new Promise((resolve, reject) => {
    const servidor = net.createServer();
    servidor.unref();
    servidor.on("error", () => resolve(portaLivre(preferida + 1)));
    servidor.listen(preferida, "127.0.0.1", () => {
      const { port } = servidor.address();
      servidor.close(() => resolve(port));
    });
  });
}

async function esperarSaudavel(url, tentativas = 60) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const resp = await fetch(url);
      if (resp.ok) return;
    } catch {
      // servidor ainda subindo
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Servidor não respondeu em ${url} a tempo.`);
}

async function continuarQuandoLiberado(pagina) {
  await pagina.waitForFunction(() => !document.getElementById("continuar").disabled);
  await pagina.click("#continuar");
}

// A Aula 1 é uma lição de uma página só, com passos que só liberam o botão
// "Continuar" depois de uma pequena interação (data-trava). Isto reproduz
// essas interações com cliques reais, na ordem em que os passos aparecem,
// só para conseguir chegar ao cartão final "Próxima: Aula 2".
async function percorrerAula1(pagina) {
  await pagina.click("#comecar"); // hero -> introdução 1
  await continuarQuandoLiberado(pagina); // introdução 1 -> introdução 2
  await continuarQuandoLiberado(pagina); // introdução 2 -> introdução 3
  await continuarQuandoLiberado(pagina); // introdução 3 -> passo "pedido genérico"

  await pagina.click("#ver-generica");
  await continuarQuandoLiberado(pagina); // -> passo "previsão de palavras"

  await pagina.locator('[data-r="1"]').first().click();
  await pagina.locator("#rodada-2:not(.oculto)").waitFor();
  await pagina.locator('[data-r="2"]').first().click();
  await continuarQuandoLiberado(pagina); // -> passo "o estagiário sem contexto"

  const itensEstagiario = pagina.locator("#lista-estagiario .item");
  const totalItens = await itensEstagiario.count();
  for (let i = 0; i < totalItens; i++) {
    await itensEstagiario.nth(i).click();
  }
  await continuarQuandoLiberado(pagina); // -> passo "método CAFÉ"

  const letrasCafe = pagina.locator(".letras .letra");
  const totalLetras = await letrasCafe.count();
  for (let i = 0; i < totalLetras; i++) {
    await letrasCafe.nth(i).click();
  }
  await continuarQuandoLiberado(pagina); // -> passo "monte seu pedido"

  const ingredientes = pagina.locator("#ingredientes .btn-linha");
  const totalIngredientes = await ingredientes.count();
  for (let i = 0; i < totalIngredientes; i++) {
    await ingredientes.nth(i).click();
  }
  await pagina.locator("#ver-cafe:not([disabled])").waitFor();
  await pagina.click("#ver-cafe");
  await continuarQuandoLiberado(pagina); // -> passo "pratique o seu pedido" (livre)

  await continuarQuandoLiberado(pagina); // -> quiz

  for (const letraCerta of ["C", "F", "A"]) {
    await pagina.locator(`#quiz-letras .letra[data-q="${letraCerta}"]`).click();
    const proxima = pagina.locator("#quiz-proxima");
    if (!(await proxima.evaluate((el) => el.classList.contains("oculto")))) {
      await proxima.click();
    }
  }
  await continuarQuandoLiberado(pagina); // -> cartão final
}

async function abrirChromium() {
  const tentativas = [{ channel: "chrome" }, { channel: "msedge" }, {}];
  let ultimoErro;
  for (const opcoes of tentativas) {
    try {
      return await chromium.launch({ headless: true, ...opcoes });
    } catch (erro) {
      ultimoErro = erro;
    }
  }
  throw new Error(
    `Não achei um Chromium para rodar (Chrome/Edge do sistema nem o do Playwright). ` +
      `Rode "npx playwright install chromium" e tente de novo.\n${ultimoErro}`
  );
}

async function main() {
  const dirTemp = fs.mkdtempSync(path.join(os.tmpdir(), "t4p-e2e-"));
  const dbPath = path.join(dirTemp, "t4p.db");

  const fakePort = await portaLivre(3391);
  const appPort = await portaLivre(3392);
  const baseUrl = `http://127.0.0.1:${appPort}`;

  mpFake.server.listen(fakePort);

  const appProcess = spawn(
    process.execPath,
    [path.join(RAIZ, "src", "server.js")],
    {
      cwd: RAIZ,
      env: {
        ...process.env,
        PORT: String(appPort),
        DB_PATH: dbPath,
        BASE_URL: baseUrl,
        NODE_ENV: "test",
        TRUST_PROXY: "0",
        MP_ACCESS_TOKEN: "TEST-fake-access-token",
        MP_WEBHOOK_SECRET: "segredo-e2e",
        MP_API_URL: `http://127.0.0.1:${fakePort}`,
        PRECO,
        ADMIN_USER,
        ADMIN_PASS,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  appProcess.stdout.on("data", (d) => process.stdout.write(`[app] ${d}`));
  appProcess.stderr.on("data", (d) => process.stderr.write(`[app] ${d}`));

  let browser;
  try {
    await esperarSaudavel(`${baseUrl}/health`);
    browser = await abrirChromium();

    // ---------- 0) a landing e o /comprar mostram o preço de lançamento (fonte única) ----------
    await passo(`GET / e /comprar mostram o preço de lançamento (R$ ${PRECO_BRL})`, async () => {
      const respLanding = await fetch(`${baseUrl}/`);
      const htmlLanding = await respLanding.text();
      if (!htmlLanding.includes(`R$ ${PRECO_BRL}`) && !htmlLanding.includes(`>${PRECO_BRL}<`) && !htmlLanding.includes(`>${PRECO_BRL}`)) {
        throw new Error(`landing não mostra o preço ${PRECO_BRL}`);
      }
      if (htmlLanding.includes("{{preco_brl}}")) {
        throw new Error("marcador {{preco_brl}} não foi substituído na landing");
      }
      if (/\bR\$\s*97\b/.test(htmlLanding)) {
        throw new Error("landing ainda mostra o preço antigo (R$ 97)");
      }

      const respComprar = await fetch(`${baseUrl}/comprar`);
      const htmlComprar = await respComprar.text();
      if (!htmlComprar.includes(`R$ ${PRECO_BRL}`)) {
        throw new Error(`/comprar não mostra o preço ${PRECO_BRL}`);
      }
    });

    // ---------- a) /admin cadastra aluno manual com valor "49,90" ----------
    const ctxAdmin = await browser.newContext({
      httpCredentials: { username: ADMIN_USER, password: ADMIN_PASS },
    });
    const paginaAdmin = await ctxAdmin.newPage();

    await passo(`/admin cadastra aluno manual com valor ${ALUNO_MANUAL.valor} (vírgula)`, async () => {
      await paginaAdmin.goto(`${baseUrl}/admin`);
      await paginaAdmin.fill("#nome", ALUNO_MANUAL.nome);
      await paginaAdmin.fill("#email", ALUNO_MANUAL.email);
      await paginaAdmin.fill("#whatsapp", ALUNO_MANUAL.whatsapp);
      await paginaAdmin.fill("#senha", ALUNO_MANUAL.senha);
      await paginaAdmin.fill("#valor", ALUNO_MANUAL.valor);
      await paginaAdmin.click('button:has-text("Cadastrar aluno")');
      await paginaAdmin.waitForURL(`${baseUrl}/admin`);
      const corpo = await paginaAdmin.content();
      if (!corpo.includes(ALUNO_MANUAL.email)) {
        throw new Error("aluno cadastrado não aparece na tabela do /admin");
      }
      if (!corpo.includes("R$")) {
        throw new Error("valor não aparece formatado na tabela do /admin");
      }
    });

    const EMAIL_LONGO = `aluno.com.nome.bem.longo.${SUFIXO}@exemplo-longo.com`;

    await passo("/admin: e-mail de 40+ caracteres não invade a coluna do WhatsApp", async () => {
      await paginaAdmin.fill("#nome", "Aluno Email Longo E2E");
      await paginaAdmin.fill("#email", EMAIL_LONGO);
      await paginaAdmin.fill("#whatsapp", "11999990003");
      await paginaAdmin.fill("#senha", "senha-email-longo-e2e");
      await paginaAdmin.fill("#valor", ALUNO_MANUAL.valor);
      await paginaAdmin.click('button:has-text("Cadastrar aluno")');
      await paginaAdmin.waitForURL(`${baseUrl}/admin`);

      if (EMAIL_LONGO.length < 40) {
        throw new Error("o e-mail de teste precisa ter pelo menos 40 caracteres");
      }

      const linha = paginaAdmin.locator("tr", { hasText: EMAIL_LONGO });
      const celulaEmail = linha.locator("td").nth(1);
      const semEstouro = await celulaEmail.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
      if (!semEstouro) {
        throw new Error("a célula do e-mail estoura a largura da coluna (invade o WhatsApp)");
      }

      const evidenciasDir = path.join(RAIZ, "docs", "claude-bridge", "evidencias");
      fs.mkdirSync(evidenciasDir, { recursive: true });
      await linha.scrollIntoViewIfNeeded();
      await paginaAdmin.screenshot({
        path: path.join(evidenciasDir, "tarefa-05-admin-email-longo.png"),
      });
    });
    await ctxAdmin.close();

    // ---------- b) /entrar com esse aluno, abre Aula 1, vai para Aula 2 ----------
    // reducedMotion: a Aula 1 é uma lição interativa com animações/digitação
    // por passo; isso faz o próprio conteúdo pular direto pro estado final
    // de cada passo, sem mudar o que é preciso clicar para destravar cada um.
    const ctxAluno = await browser.newContext({ reducedMotion: "reduce" });
    const paginaAluno = await ctxAluno.newPage();

    await passo("/entrar com o aluno manual → /aluno → Aula 1 → Aula 2", async () => {
      await paginaAluno.goto(`${baseUrl}/entrar`);
      await paginaAluno.fill("#email", ALUNO_MANUAL.email);
      await paginaAluno.fill("#senha", ALUNO_MANUAL.senha);
      await paginaAluno.click('button:has-text("Entrar")');
      await paginaAluno.waitForURL(`${baseUrl}/aluno`);
      const titulo = await paginaAluno.locator("h1").textContent();
      if (!titulo || !titulo.includes(ALUNO_MANUAL.nome)) {
        throw new Error("página /aluno não mostrou o nome do aluno logado");
      }

      const [aula1] = await Promise.all([
        ctxAluno.waitForEvent("page"),
        paginaAluno.getByRole("link", { name: "Abrir aula" }).first().click(),
      ]);
      await aula1.waitForLoadState();
      if (!aula1.url().includes("Aula1_O_Pedido_que_Funciona.html")) {
        throw new Error("clique em 'Abrir aula' não abriu a Aula 1");
      }

      await percorrerAula1(aula1);

      await aula1.getByRole("link", { name: "Ir para a Aula 2" }).click();
      await aula1.waitForURL(/Aula2_Conserte_a_Resposta\.html/);
      await aula1.close();
    });
    await ctxAluno.close();

    // ---------- c) /comprar → paga no mp-fake → cai sozinho em /aluno ----------
    const ctxCompra = await browser.newContext();
    const paginaCompra = await ctxCompra.newPage();

    await passo(
      "/comprar → /pagamento mostra QR → aprovado no mp-fake → cai em /aluno sozinho",
      async () => {
        await paginaCompra.goto(`${baseUrl}/comprar`);
        await paginaCompra.fill("#nome", ALUNO_PIX.nome);
        await paginaCompra.fill("#email", ALUNO_PIX.email);
        await paginaCompra.fill("#whatsapp", ALUNO_PIX.whatsapp);
        await paginaCompra.fill("#senha", ALUNO_PIX.senha);
        await paginaCompra.check('input[name="aceite"]');
        await paginaCompra.click('button:has-text("Gerar PIX")');
        await paginaCompra.waitForURL(/\/pagamento\//);

        const token = new URL(paginaCompra.url()).pathname.split("/")[2];
        const qrSrc = await paginaCompra.locator("img.qr").getAttribute("src");
        if (!qrSrc || !qrSrc.startsWith("data:image")) {
          throw new Error("/pagamento não mostrou o QR Code");
        }
        const copiaCola = await paginaCompra.locator("#copiaCola").inputValue();
        if (!copiaCola) {
          throw new Error("/pagamento não mostrou o copia-e-cola");
        }

        // Aprova o pagamento no servidor falso do MP (é o MP real quem faria
        // isso; não existe formulário no nosso app para simular isso).
        const respAprovar = await fetch(`http://127.0.0.1:${fakePort}/__set/1000`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" }),
        });
        if (!respAprovar.ok) {
          throw new Error(`mp-fake não aceitou a aprovação (status ${respAprovar.status})`);
        }

        // Confere que o valor cobrado no MP é exatamente o preço mostrado na
        // landing/comprar (mesma fonte, o pedido 1000 é o único criado até aqui).
        const pagamentoFake = await (await fetch(`http://127.0.0.1:${fakePort}/v1/payments/1000`)).json();
        if (pagamentoFake.transaction_amount !== PRECO_NUM) {
          throw new Error(
            `valor cobrado no mp-fake (${pagamentoFake.transaction_amount}) diferente do preço mostrado (${PRECO_NUM})`
          );
        }

        // A própria página, pelo polling, detecta o pagamento e navega sozinha.
        await paginaCompra.waitForURL((url) => url.pathname === "/aluno", { timeout: 20000 });
        const titulo = await paginaCompra.locator("h1").textContent();
        if (!titulo || !titulo.includes(ALUNO_PIX.nome)) {
          throw new Error("não caiu na área do aluno certo depois do pagamento");
        }
        void token;
      }
    );

    // ---------- d) /sair funciona ----------
    await passo("/sair encerra a sessão e volta para /entrar", async () => {
      await paginaCompra.click('button:has-text("Sair")');
      await paginaCompra.waitForURL(`${baseUrl}/entrar`);
    });
    await ctxCompra.close();

    // ---------- e) eventos: sem mp_ignorado "pending", e mp_aprovado com origem= ----------
    const ctxEventos = await browser.newContext({
      httpCredentials: { username: ADMIN_USER, password: ADMIN_PASS },
    });
    const paginaEventos = await ctxEventos.newPage();

    await passo("eventos: sem mp_ignorado pending repetido, e mp_aprovado registra origem=", async () => {
      await paginaEventos.goto(`${baseUrl}/admin`);
      const corpo = await paginaEventos.content();
      if (/mp_ignorado[^<]*status=pending/.test(corpo)) {
        throw new Error("o polling ainda registra mp_ignorado para status pending");
      }
      if (!/mp_aprovado[^<]*origem=polling/.test(corpo)) {
        throw new Error("o evento mp_aprovado não registra origem=polling");
      }
    });
    await ctxEventos.close();
  } finally {
    if (browser) await browser.close();
    appProcess.kill();
    await new Promise((resolve) => mpFake.server.close(resolve));
    try {
      fs.rmSync(dirTemp, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
}

main()
  .then(() => {
    console.log("");
    console.log(`${passos.filter((p) => p.ok).length}/${passos.length} passos OK`);
    process.exit(falhou ? 1 : 0);
  })
  .catch((erro) => {
    console.error("Falha ao rodar o e2e:", erro);
    process.exit(1);
  });
