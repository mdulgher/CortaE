# CortaÊ — Escolha. Peça. Receba!

Demonstração de um app de pedidos de carne de açougues parceiros, feita para o **TCC da Karla**.
Não é um produto: serve para a apresentação e depois será descartada.

É uma **página web responsiva**, aberta no **Safari do celular** (não é app de loja). Tem três telas e uma página extra:

| Tela | Endereço | Onde abrir na apresentação |
|---|---|---|
| App do cliente | `index.html` | Safari do celular |
| Painel do açougue | `acougue.html` | notebook ou tablet de quem faz o açougue |
| Monitor ao vivo | `monitor.html` | TV (notebook ligado por HDMI), em tela cheia (botão de tela cheia, no canto de cima) |
| Seja parceiro | `parceiro.html` | notebook: cadastro do açougue em 6 etapas |

O fluxo da demo: o cliente escolhe o açougue e os produtos, paga (simulado: Pix, cartão ou dinheiro) e acompanha o pedido.
O açougue recebe o pedido com aviso sonoro, aceita e marca "saiu para entrega"; daí o motoboy anda sozinho no mapa
por 30 segundos até "entregue". A TV mostra tudo ao vivo. Há também kits (produto comum) e assinatura (plano, frequência
e dia, sem cobrança).

### O que veio do plano de negócio da Karla (PDF "CORTAE_plano_de_negocio_blueprint v1", 2026-11-24)

Blueprint do pedido, com os pontos críticos de cada etapa:

- **Escolher:** o açougue marca um corte como esgotado (painel → Estoque) e o app mostra "esgotado" e sugere um substituto.
  A página do açougue mostra razão social, CNPJ, licença sanitária e origem da carne (Decreto 7.962/2013), tudo fictício.
- **Pagar:** checagem antifraude, aprovação e confirmação por e-mail, encenadas.
- **Acompanhar:** avisos no estilo push. Há um prazo máximo de aceite (`ACEITE_SEGUNDOS`, 1 min); se estourar, o painel
  e a TV alertam a equipe CortaÊ.
- **Receber:** embalagem térmica lacrada, temperatura na entrega (até 4 °C) e o botão "Recebi e conferi".
- **Avaliar e voltar:** nota do açougue e da entrega, que muda a nota do açougue no app. Também chat de atendimento e
  reclamação; o açougue aprova o estorno, que sai do repasse. Há ainda "Pedir de novo" e um lembrete de recompra.
- **Recusa:** um pedido pago e recusado mostra o estorno automático.
- **Painel:** abas Estoque, Repasse (comissão do plano, taxa do pagamento online e conciliação) e Documentos
  (vencimentos com aviso 30 dias antes e temperaturas da CVS 3/2026).
- **Cliente:** tela "Sobre o CortaÊ", com missão, visão, valores e o porquê do nome.

Blueprint do cadastro do parceiro (`parceiro.html`): inscrição, envio de documentos, validação (com uma pendência a
corrigir), contrato com escolha do plano e treinamento, vitrine e loja ativa. O açougue novo aparece na lista do app.

### Pedidos da Karla de 2026-11-26 (versão 0.3.0)

- **Prazo da assinatura com desconto:** mensal (preço cheio), semestral (5% mais barato) e anual (10% mais barato).
  Preço por entrega = preço do plano × (1 − desconto). Regras em `PRAZOS` (`js/catalogo.js`).
- **Promoção: kit de presente ao renovar**, que cresce com o prazo: mensal ganha pão de alho + sal grosso,
  semestral ganha o Kit Fit e anual ganha o Kit Churrasco. O presente é o do prazo que terminou e vai **junto com a
  1ª entrega do novo período**. Na renovação o cliente pode mudar o prazo. Na demo, "Simular renovação" (tela da
  assinatura) faz a renovação na hora; o painel mostra "Levar Kit…" e o botão "Presente entregue"; a TV anuncia.
- **Calculadora de churrasco** (`#/churrasco`, atalho no início): adultos e crianças, açougue, e devolve carne
  (~400 g por adulto e 200 g por criança: 60% bovina, 20% linguiça, 20% frango), carvão (1 kg por kg de carne),
  sal grosso, pão de alho e farofa, já em embalagens e preço. Corte esgotado vira o substituto. "Pôr tudo no
  carrinho" monta o pedido. Regras em `CHURRASCO` e `calcularChurrasco` (`js/catalogo.js`).

Comissões e mensalidades usam os planos do iFood citados no PDF (Básico 12%, Entrega 23%, mais 3,2% no pagamento online).
São só referência: o valor final é decisão do grupo.

## Como funciona por dentro

- HTML, CSS e JavaScript puros, **sem instalação e sem build**. Mapa: Leaflet + OpenStreetMap.
- Visual: vinho e mostarda do logo como acento, fundo claro com tom de papel de açougue; fontes Baloo 2 (títulos) e
  Figtree (texto); ícones de traço desenhados em `js/icones.js`. Cores e tema claro/escuro em `css/app.css`.
- `js/db.js` é a fachada de dados; as telas só falam com ela. Duas implementações com a mesma interface:
  - **local** (`js/db-local.js`): guarda no navegador e sincroniza só entre abas do **mesmo** navegador. Serve para ensaiar.
  - **Supabase** (`js/db-supabase.js`): tempo real entre aparelhos. É o que a apresentação usa (celular + açougue + TV).
- O catálogo (açougues, produtos, kits, planos, requisitos e documentos) é fictício e fica em `js/catalogo.js`.
  O banco guarda pedidos (com `extras`: avaliação, chat, reclamação, estorno), assinaturas, cortes esgotados e cadastros de parceiros.
- Regras comuns às telas (prazo de aceite, estorno, estrelas) ficam em `js/regras.js`; estilos das peças novas, em `css/blueprint.css`.
- Sem login: o cliente digita o nome na primeira vez.

## Rodar no computador

Precisa só do Node.

```
node ferramentas/servidor.mjs
```

Abra `http://localhost:5173`, `http://localhost:5173/acougue.html`, `http://localhost:5173/monitor.html` e
`http://localhost:5173/parceiro.html` em abas do mesmo navegador (com `?fonte=local` enquanto o Supabase estiver pausado).

## Ligar o Supabase (para usar em aparelhos diferentes)

**Já está ligado** ao projeto `CortaE` desde 2026-11-20. Os passos abaixo servem só para refazer num projeto novo.

O `supabase/schema.sql` pode ser repetido sem perder dados. Versões 0.2.0 (`pedidos.extras`, `esgotados`,
`parceiros`) e 0.3.0 (`assinaturas.prazo` e `assinaturas.extras`) já aplicadas no projeto `CortaE` em 2026-11-26.

1. Criar um projeto no Supabase (plano Free).
2. No **SQL Editor**, rodar o arquivo `supabase/schema.sql` inteiro.
3. Em **Project Settings → API**, copiar a **Project URL** e a chave **anon / publishable** para `js/config.js`
   (`SUPABASE_URL` e `SUPABASE_KEY`). Essa chave é pública por natureza. **Nunca** colocar a `service_role`.
4. Publicar de novo. Para forçar o modo local mesmo com o Supabase ligado: `?fonte=local` no endereço.

## Desligado fora de uso

Por decisão do Marcos (2026-11-21), **o site e o banco ficam desligados** quando ninguém está usando, porque a demo
não tem segurança (sem login, tabelas abertas). Para ensaiar ou apresentar, religar os dois **com pelo menos 15 minutos
de folga** e desligar de novo no fim. Desligado, o site responde 404 e o banco não aceita conexão; nada se perde.

| | Religar | Desligar |
|---|---|---|
| Banco (Supabase) | painel do Supabase → projeto `CortaE` → **Restore project** (leva alguns minutos) | painel → Project Settings → **Pause project** |
| Site (GitHub Pages) | repositório → Settings → Pages → Source: branch `main`, pasta `/` → Save (ou `gh api -X POST repos/mdulgher/CortaE/pages -f "source[branch]=main" -f "source[path]=/"`) | Settings → Pages → **Unpublish** (ou `gh api -X DELETE repos/mdulgher/CortaE/pages`) |

O Supabase Free só deixa restaurar pelo painel um projeto pausado há menos de 90 dias, o que cobre a apresentação.

## Antes de apresentar

- O Supabase Free **pausa o projeto depois de ~7 dias sem uso**. Abrir o app na véspera e no dia.
- Zerar a demonstração (botão de seta circular no painel do açougue, ou Minha Conta → Zerar demonstração) para os pedidos começarem do #1.
- No painel do açougue, tocar em **Ativar som** (o navegador só toca som depois de um toque; qualquer clique no painel também libera).
- Na TV, abrir o monitor e tocar no botão de tela cheia. Sem tela cheia o monitor também cabe, mas maior fica melhor de longe.
- Tocar uma vez em cada tela: depois do primeiro toque, elas pedem ao aparelho para não apagar (iPhone com iOS 16.4 ou mais novo).
  Por garantia, no iPhone: Ajustes → Tela e Brilho → Bloqueio Automático → Nunca; no Windows da TV e do painel, tela e suspensão em "Nunca".
- Se o celular bloquear ou a rede piscar, as telas se acertam sozinhas em até 5 segundos (não precisa recarregar).
- Testar a internet do local: as três telas precisam dela (Supabase e mapa).
- **Antes de publicar uma mudança, subir a versão:** `node ferramentas/versao.mjs 0.3.2` (troca o `RELEASE` e o `?v=` de
  todos os arquivos). Sem isso, o Safari pode misturar arquivo novo com velho do cache e o app fica em branco (aconteceu em
  2026-11-26 na 0.3.0). Se mesmo assim a tela não desenhar em 8 s, o app mostra um botão "Recarregar".
- **Depois de publicar uma mudança**, o navegador pode guardar a versão antiga por até **10 minutos** (cache do GitHub Pages).
  Não publicar nada na última hora antes da apresentação; se publicar, esperar 10 minutos e recarregar as três telas.

## No ar

https://mdulgher.github.io/CortaE/ · [painel do açougue](https://mdulgher.github.io/CortaE/acougue.html) · [monitor da TV](https://mdulgher.github.io/CortaE/monitor.html)
