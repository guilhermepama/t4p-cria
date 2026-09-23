# Tarefa 06 · WhatsApp de contato em todo o site

**Status: AGUARDANDO EXECUÇÃO**

- **Tipo:** código pequeno (texto + configuração).
- **Data:** 23/09/2026
- **Base:** `concluidas/05-preco-lancamento.md` (padrão `{{preco_brl}}` injetado pelo servidor)

## Decisão de produto

WhatsApp oficial da T4P: **(19) 97413-9426**, que no formato do wa.me fica `5519974139426`. É o número pessoal do Guilherme, por decisão dele.

## Antes de começar

Crie `tarefa/06-whatsapp` a partir da `main` atualizada. O primeiro commit leva só a documentação pendente do planejador (o arquivamento da 05 e o deploy): `docs: planejador — tarefa 06`.

## Mecanismo proposto

1. **Uma fonte só**, com o mesmo padrão do preço:
   - Variável `WHATSAPP` (só dígitos, com DDI). Se estiver vazia, o padrão no código é `5519974139426`.
   - Adicione ao `.env.example`.
   - O servidor injeta na landing `{{whatsapp}}` (os dígitos) e `{{whatsapp_fmt}}` (`(19) 97413-9426`).
   - A `const WHATSAPP = ""` da landing passa a receber `{{whatsapp}}`.
2. **Landing:**
   - O link do FAQ de equipes volta a funcionar (o JS já existe, só depende da constante preenchida).
   - Na garantia, "É só chamar a gente" vira link: "É só chamar a gente no WhatsApp".
   - No rodapé, acrescente "WhatsApp (19) 97413-9426" com link.
3. **Views:**
   - `comprar-indisponivel.html`: "fale com a gente" vira link do WhatsApp com a mensagem pronta "Oi! Quero comprar o kit IA para Negócios por PIX direto."
   - Mensagem de usuário inativo no `/entrar`: "fale com a gente" vira link com a mensagem "Oi! Já paguei o kit e meu acesso não foi liberado."
   - `pagamento.html`: acrescente, abaixo do QR, uma linha discreta: "Pagou e não liberou? Fale com a gente no WhatsApp."
   - `aluno.html`: no rodapé, "Dúvidas? WhatsApp (19) 97413-9426".
   - `privacidade.html`: acrescente o WhatsApp ao contato, junto com o e-mail.
4. Todos os links usam `https://wa.me/<digitos>?text=<encodeURIComponent(msg)>`, com `target="_blank" rel="noopener"`.

## Fora de escopo

Mudanças de preço, de texto de oferta ou em `conteudo/`.

## Validação

1. `grep -rn "fale com a gente\|chamar a gente" src/views public` → todas as ocorrências viraram link.
2. O `npm run e2e` passa. Acrescente um passo: a landing tem pelo menos 3 links `wa.me/5519974139426`, e nenhum `{{whatsapp` sobra no HTML.
3. Com `WHATSAPP=5511900000000`, a landing e as views mostram o número novo. Isso prova que existe uma fonte só.
4. `docker build` passa.

## Entrega

Branch `tarefa/06-whatsapp`. Push liberado para abrir o PR. Sem merge. Preencha o relatório e mude o Status.

## Relatório do executor

_(preencher aqui)_
