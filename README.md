# CortaÊ — Escolha. Peça. Receba!

Demonstração de um app de pedidos de carne de açougues parceiros, feita para o **TCC da Karla**.
Não é um produto: serve para a apresentação e depois será descartada.

É uma **página web responsiva**, aberta no **Safari do celular** (não é app de loja). Tem três telas:

| Tela | Endereço | Onde abrir na apresentação |
|---|---|---|
| App do cliente | `index.html` | Safari do celular |
| Painel do açougue | `acougue.html` | notebook ou tablet de quem faz o açougue |
| Monitor ao vivo | `monitor.html` | TV (notebook ligado por HDMI), em tela cheia (botão ⛶) |

O fluxo da demo: o cliente escolhe o açougue e os produtos, paga (simulado: Pix, cartão ou dinheiro) e acompanha o pedido.
O açougue recebe o pedido com aviso sonoro, aceita e marca "saiu para entrega"; daí o motoboy anda sozinho no mapa
por 30 segundos até "entregue". A TV mostra tudo ao vivo. Há também kits (produto comum) e assinatura (plano, frequência
e dia, sem cobrança).

## Como funciona por dentro

- HTML, CSS e JavaScript puros, **sem instalação e sem build**. Mapa: Leaflet + OpenStreetMap.
- `js/db.js` é a fachada de dados; as telas só falam com ela. Duas implementações com a mesma interface:
  - **local** (`js/db-local.js`): guarda no navegador e sincroniza só entre abas do **mesmo** navegador. Serve para ensaiar.
  - **Supabase** (`js/db-supabase.js`): tempo real entre aparelhos. É o que a apresentação usa (celular + açougue + TV).
- O catálogo (açougues, produtos, kits, planos) é fictício e fica em `js/catalogo.js`. Só pedidos e assinaturas vão para o banco.
- Sem login: o cliente digita o nome na primeira vez.

## Rodar no computador

Precisa só do Node.

```
node ferramentas/servidor.mjs
```

Abra `http://localhost:5173`, `http://localhost:5173/acougue.html` e `http://localhost:5173/monitor.html` em abas do mesmo navegador.

## Ligar o Supabase (para usar em aparelhos diferentes)

1. Criar um projeto no Supabase (plano Free).
2. No **SQL Editor**, rodar o arquivo `supabase/schema.sql` inteiro.
3. Em **Project Settings → API**, copiar a **Project URL** e a chave **anon / publishable** para `js/config.js`
   (`SUPABASE_URL` e `SUPABASE_KEY`). Essa chave é pública por natureza. **Nunca** colocar a `service_role`.
4. Publicar de novo. Para forçar o modo local mesmo com o Supabase ligado: `?fonte=local` no endereço.

## Antes de apresentar

- O Supabase Free **pausa o projeto depois de ~7 dias sem uso**. Abrir o app na véspera e no dia.
- Zerar a demonstração (🧹 no painel do açougue, ou Minha Conta → Zerar) para os pedidos começarem do #1.
- No painel do açougue, tocar em **🔔 Ativar som** (o navegador só toca som depois de um toque).
- Na TV, abrir o monitor e tocar em ⛶ para tela cheia.
- Testar a internet do local: as três telas precisam dela (Supabase e mapa).
