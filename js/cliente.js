// App do cliente (celular): catálogo, carrinho, pedido, acompanhamento e assinatura.
import { db, novoId } from './db.js';
import { CONFIG } from './config.js';
import {
  ACOUGUES, CATEGORIAS, PRODUTOS, PLANOS, FREQUENCIAS, DIAS_SEMANA, STATUS, ETAPAS, CLIENTE_PADRAO,
  acougue, produto, plano, frequencia,
} from './catalogo.js';
import {
  esc, dinheiro, hora, iniciarTema, atualizarBotoesTema, toast, confirmar, vigiarErros,
} from './ui.js';
import { htmlTimeline } from './timeline.js';
import { MapaEntrega, segundosRestantes, progressoEntrega, concluirEntregasVencidas } from './entrega.js';

vigiarErros();
iniciarTema();

const $topo = document.getElementById('topo');
const $tela = document.getElementById('tela');
const $abas = document.getElementById('abas');

// ---------- Estado do aparelho (perfil e carrinho ficam só neste celular) ----------
const LS = {
  get(k, padrao) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch { return padrao; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
};
let cliente = LS.get('cortae.cliente', null);
let carrinho = LS.get('cortae.carrinho', { acougue_id: null, itens: {} });
let pedidos = [];
let assinaturas = [];
let api;
let mapa = null;
let slideTimer = null;
const statusVistos = new Map();
const escolha = { pagamento: 'pix', plano: 'churrasco', freq: 'quinzenal', dia: 6, acougue: 'boi' };

const round2 = (v) => Math.round(v * 100) / 100;
const totalItens = () => Object.values(carrinho.itens).reduce((s, q) => s + q, 0);
const meusPedidos = () => pedidos.filter((p) => p.cliente_id === cliente?.id);
const minhaAssinatura = () => assinaturas.find((a) => a.cliente_id === cliente?.id && a.status !== 'cancelada');
const pedidoAtivo = () => meusPedidos().find((p) => ['recebido', 'preparando', 'saiu'].includes(p.status));
const normal = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function salvarCarrinho() { LS.set('cortae.carrinho', carrinho); atualizarBadge(); }

// ---------- Rotas ----------
function rota() {
  const h = location.hash.replace(/^#\/?/, '');
  const [caminho, query] = h.split('?');
  const partes = caminho.split('/').filter(Boolean);
  return { nome: partes[0] || 'inicio', param: partes[1] ? decodeURIComponent(partes[1]) : null, query: new URLSearchParams(query || '') };
}

const ABA_DE = {
  inicio: 'inicio', acougues: 'inicio', acougue: 'inicio', busca: 'inicio', carrinho: 'inicio',
  categorias: 'categorias', categoria: 'categorias', pedido: 'pedidos', pedidos: 'pedidos',
  assinatura: 'assinatura', conta: 'conta',
};

function render() {
  const r = rota();
  const view = VIEWS[r.nome] || VIEWS.inicio;
  if (mapa) { mapa.mapa.remove(); mapa = null; }
  clearInterval(slideTimer);
  const out = view(r);
  $topo.className = 'topo';
  $topo.innerHTML = out.topo;
  $tela.innerHTML = out.html;
  $abas.querySelectorAll('.aba').forEach((a) => a.classList.toggle('ativa', a.dataset.aba === ABA_DE[r.nome]));
  atualizarBotoesTema();
  atualizarBadge();
  out.depois?.();
}

// ---------- Topo ----------
const botaoCarrinho = '<a class="icone-btn" href="#/carrinho" aria-label="Carrinho">🛒<span class="badge oculto" data-badge></span></a>';

function topoGrande() {
  return `
    <div class="topo-linha">
      <div class="topo-acoes">
        <a class="icone-btn" href="#/conta" aria-label="Menu">☰</a>
        <button class="icone-btn" data-tema-btn></button>
      </div>
      <img class="logo-img" src="img/logo.jpg" alt="CortaÊ — Escolha. Peça. Receba!">
      <div class="topo-acoes">
        <a class="icone-btn" href="#/pedidos" aria-label="Meus pedidos">🔔</a>
        ${botaoCarrinho}
      </div>
    </div>
    <div class="local">📍 Entregar em: <b>Santos - SP</b></div>
    <button class="busca" data-acao="ir-busca">🔍 <span>O que você procura?</span></button>`;
}

function topoMini(titulo) {
  return `
    <div class="topo-mini">
      <button class="icone-btn" data-acao="voltar" aria-label="Voltar">←</button>
      <h1>${esc(titulo)}</h1>
      <button class="icone-btn" data-tema-btn></button>
      ${botaoCarrinho}
    </div>`;
}

function atualizarBadge() {
  const n = totalItens();
  document.querySelectorAll('[data-badge]').forEach((b) => {
    b.textContent = n;
    b.classList.toggle('oculto', n === 0);
  });
}

// ---------- Pedaços reutilizados ----------
function controle(id) {
  const q = carrinho.itens[id] || 0;
  if (!q) return `<button class="add" data-acao="add" data-id="${id}" aria-label="Adicionar">+</button>`;
  return `<div class="qtd">
    <button data-acao="menos" data-id="${id}" aria-label="Diminuir">−</button><span>${q}</span>
    <button data-acao="add" data-id="${id}" aria-label="Aumentar">+</button></div>`;
}

function cartaoProduto(p, mostrarLoja = false) {
  return `
    <div class="prod">
      <div class="prod-ico cat-${p.cat}">${p.icone}</div>
      <div class="prod-info">
        <strong>${esc(p.nome)}</strong>
        <small>${esc(p.peso)}</small>
        ${mostrarLoja ? `<small class="loja-nome">${esc(acougue(p.acougue).nome)}</small>` : ''}
        <span class="preco">${dinheiro(p.preco)}</span>
      </div>
      <div data-ctl="${p.id}">${controle(p.id)}</div>
    </div>`;
}

function cartaoLoja(a) {
  return `
    <a class="loja" href="#/acougue/${a.id}">
      <div class="ico">${a.icone}</div>
      <div>
        <strong>${esc(a.nome)} <span class="verificado" title="Parceiro verificado">✔︎</span></strong>
        <small>${esc(a.desc)}</small>
        <div class="meta"><span class="estrela">★ ${a.nota.toFixed(1)}</span><span>⏱ ${a.tempo}</span><span>🛵 ${dinheiro(a.taxa)}</span></div>
      </div>
    </a>`;
}

function cartaoPedidoAtivo(p) {
  const s = STATUS[p.status];
  return `
    <a class="pedido-ativo" href="#/pedido/${p.id}">
      <span class="ico">${s.icone}</span>
      <span>Pedido #${p.numero} · ${esc(s.nome)}<small>${esc(acougue(p.acougue_id)?.nome || '')} · toque para acompanhar</small></span>
      <span>→</span>
    </a>`;
}

// ---------- Telas ----------
function inicio() {
  const ativo = pedidoAtivo();
  const destaques = PRODUTOS.filter((p) => p.destaque);
  return {
    topo: topoGrande(),
    html: `
      <div id="slot-ativo">${ativo ? cartaoPedidoAtivo(ativo) : ''}</div>
      <div class="atalhos">
        <a class="atalho atalho-1" href="#/acougues"><span class="ico">🥩</span>Açougues</a>
        <a class="atalho atalho-2" href="#/categoria/kits"><span class="ico">📦</span>Kits</a>
        <a class="atalho atalho-3" href="#/assinatura"><span class="ico">🔄</span>Assinatura</a>
        <a class="atalho atalho-4" href="#/categoria/outros"><span class="ico">🧺</span>Outros Produtos</a>
      </div>
      <div class="carrossel">
        <div class="slides" id="slides">
          <div class="slide">
            <h3>Kits <b>Especiais</b></h3>
            <p>Praticidade e qualidade na sua mesa!</p>
            <a class="btn btn-ama" href="#/categoria/kits">Ver Kits →</a>
            <img src="img/banner-carne.jpg" alt="">
          </div>
          <div class="slide slide-2">
            <h3>Carne fresca <b style="color:#5e0707">toda semana</b></h3>
            <p>Assine e receba sem precisar lembrar.</p>
            <a class="btn btn-pri" href="#/assinatura">Assinar →</a>
            <span class="arte">🔄</span>
          </div>
          <div class="slide slide-3">
            <h3>Churrasco <b>de sábado</b></h3>
            <p>Picanha, linguiça e carvão em um só pedido.</p>
            <a class="btn btn-ama" href="#/categoria/bovinos">Ver cortes →</a>
            <span class="arte">🔥</span>
          </div>
        </div>
        <div class="pontos" id="pontos"><i class="ativo"></i><i></i><i></i></div>
      </div>
      <section>
        <div class="secao-titulo"><h2>Açougues Parceiros</h2><a href="#/acougues">Ver todos →</a></div>
        <div class="lojas-h">
          ${ACOUGUES.map((a) => `<a class="loja-mini" href="#/acougue/${a.id}"><span class="ico">${a.icone}</span>${esc(a.nome)} <span class="verificado">✔︎</span></a>`).join('')}
        </div>
      </section>
      <section>
        <div class="secao-titulo"><h2>Mais pedidos</h2></div>
        <div class="destaques">
          ${destaques.map((p) => `
            <div class="dest">
              <div class="prod-ico cat-${p.cat}">${p.icone}</div>
              <strong>${esc(p.nome)}</strong>
              <small>${esc(acougue(p.acougue).nome)}</small>
              <div class="linha"><span class="preco">${dinheiro(p.preco)}</span><span data-ctl="${p.id}">${controle(p.id)}</span></div>
            </div>`).join('')}
        </div>
      </section>`,
    depois: iniciarCarrossel,
  };
}

function iniciarCarrossel() {
  const slides = document.getElementById('slides');
  const pontos = [...document.querySelectorAll('#pontos i')];
  if (!slides) return;
  const atual = () => Math.round(slides.scrollLeft / slides.clientWidth);
  slides.addEventListener('scroll', () => pontos.forEach((p, i) => p.classList.toggle('ativo', i === atual())), { passive: true });
  slideTimer = setInterval(() => {
    const prox = (atual() + 1) % pontos.length;
    slides.scrollTo({ left: prox * slides.clientWidth, behavior: 'smooth' });
  }, 4500);
}

function listaAcougues() {
  return { topo: topoMini('Açougues'), html: `<div class="lista">${ACOUGUES.map(cartaoLoja).join('')}</div>` };
}

function telaAcougue(r) {
  const a = acougue(r.param);
  if (!a) return { topo: topoMini('Açougue'), html: '<div class="vazio">Açougue não encontrado.</div>' };
  const cat = r.query.get('cat') || 'todos';
  const prods = PRODUTOS.filter((p) => p.acougue === a.id && (cat === 'todos' || p.cat === cat));
  const chip = (id, nome) => `<a class="chip ${cat === id ? 'ativo' : ''}" href="#/acougue/${a.id}?cat=${id}" style="text-decoration:none">${nome}</a>`;
  return {
    topo: topoMini(a.nome),
    html: `
      <div class="loja-capa">
        <span class="ico">${a.icone}</span>
        <h2>${esc(a.nome)} <span class="verificado">✔︎</span></h2>
        <small style="color:var(--muted);font-weight:700">${esc(a.endereco)} · Parceiro verificado (alvará e inspeção sanitária)</small>
        <div class="meta"><span class="estrela">★ ${a.nota.toFixed(1)}</span><span>⏱ ${a.tempo}</span><span>🛵 Entrega ${dinheiro(a.taxa)}</span></div>
      </div>
      <div class="chips chips-rolar">${chip('todos', 'Todos')}${CATEGORIAS.map((c) => chip(c.id, `${c.icone} ${c.nome}`)).join('')}</div>
      <div class="lista">${prods.map((p) => cartaoProduto(p)).join('')}</div>`,
  };
}

function categorias() {
  return {
    topo: topoMini('Categorias'),
    html: `<div class="categorias">${CATEGORIAS.map((c) => `
      <a class="cat cat-${c.id}" href="#/categoria/${c.id}"><span class="ico">${c.icone}</span>${esc(c.nome)}</a>`).join('')}</div>`,
  };
}

function categoria(r) {
  const c = CATEGORIAS.find((x) => x.id === r.param) || CATEGORIAS[0];
  const prods = PRODUTOS.filter((p) => p.cat === c.id);
  return {
    topo: topoMini(c.nome),
    html: `<div class="lista">${prods.map((p) => cartaoProduto(p, true)).join('')}</div>`,
  };
}

function resultadosBusca(q) {
  const termo = normal(q.trim());
  if (!termo) return '<div class="vazio"><span class="grande">🔍</span>Digite um corte, kit ou açougue.</div>';
  const achados = PRODUTOS.filter((p) => normal(`${p.nome} ${p.peso} ${acougue(p.acougue).nome} ${p.cat}`).includes(termo));
  if (!achados.length) return '<div class="vazio"><span class="grande">🤷</span>Nada encontrado.</div>';
  return `<div class="lista">${achados.map((p) => cartaoProduto(p, true)).join('')}</div>`;
}

function busca(r) {
  const q = r.query.get('q') || '';
  return {
    topo: topoMini('Buscar'),
    html: `
      <label class="busca" style="box-shadow:var(--sombra)">🔍 <input id="q" placeholder="O que você procura?" value="${esc(q)}" autocomplete="off"></label>
      <div id="resultados">${resultadosBusca(q)}</div>`,
    depois() {
      const input = document.getElementById('q');
      input.focus();
      input.addEventListener('input', () => { document.getElementById('resultados').innerHTML = resultadosBusca(input.value); });
    },
  };
}

function telaCarrinho() {
  if (!totalItens()) {
    return {
      topo: topoMini('Carrinho'),
      html: '<div class="vazio"><span class="grande">🛒</span><b>Seu carrinho está vazio</b><a class="btn btn-pri" href="#/acougues">Escolher um açougue</a></div>',
    };
  }
  const a = acougue(carrinho.acougue_id);
  const itens = Object.entries(carrinho.itens).map(([id, qtd]) => ({ p: produto(id), qtd }));
  const subtotal = round2(itens.reduce((s, i) => s + i.p.preco * i.qtd, 0));
  const total = round2(subtotal + a.taxa);
  const pag = (id, ico, nome, sub) => `
    <button class="pagamento ${escolha.pagamento === id ? 'ativo' : ''}" data-acao="pagamento" data-id="${id}">
      <span class="ico">${ico}</span><span>${nome}<small>${sub}</small></span></button>`;
  return {
    topo: topoMini('Carrinho'),
    html: `
      <div class="cartao">
        <div class="secao-titulo" style="margin-bottom:6px"><h2>${a.icone} ${esc(a.nome)}</h2><a href="#/acougue/${a.id}">+ itens</a></div>
        ${itens.map(({ p, qtd }) => `
          <div class="item-car">
            <div><strong>${esc(p.nome)}</strong><small>${esc(p.peso)} · ${dinheiro(p.preco)}</small><small><b>${dinheiro(p.preco * qtd)}</b></small></div>
            <div data-ctl="${p.id}">${controle(p.id)}</div>
          </div>`).join('')}
      </div>
      <div class="cartao"><label class="campo">📍 Entregar em
        <input id="endereco" value="${esc(cliente?.endereco || CLIENTE_PADRAO.endereco)}"></label></div>
      <div class="cartao" style="display:grid;gap:10px">
        <h2 style="font-size:1.05rem;font-weight:900">Pagamento</h2>
        <div class="pagamentos">
          ${pag('pix', '⚡', 'Pix', 'Aprovação na hora')}
          ${pag('cartao', '💳', 'Cartão de crédito', 'Final 4242')}
          ${pag('dinheiro', '💵', 'Dinheiro na entrega', 'Leve troco para R$ 200')}
        </div>
        <p class="aviso-demo">Demonstração: nenhum valor é cobrado de verdade.</p>
      </div>
      <div class="cartao resumo">
        <div><span>Subtotal</span><span>${dinheiro(subtotal)}</span></div>
        <div><span>Taxa de entrega</span><span>${dinheiro(a.taxa)}</span></div>
        <div class="total"><span>Total</span><span>${dinheiro(total)}</span></div>
      </div>
      <div class="rodape-fixo"><button class="btn btn-pri btn-bloco" data-acao="finalizar">Fazer pedido · ${dinheiro(total)}</button></div>`,
  };
}

function htmlStatus(p) {
  const s = STATUS[p.status];
  const a = acougue(p.acougue_id);
  const sub = {
    recebido: `Aguardando o ${a.nome} confirmar`,
    preparando: `O ${a.nome} está separando seus cortes`,
    saiu: `Motoboy a caminho · chega em ${segundosRestantes(p)}s`,
    entregue: `Entregue às ${hora(p.entregue_em)}. Bom apetite! 🍖`,
    recusado: 'O açougue não pôde atender. Nenhum valor foi cobrado.',
  }[p.status];
  return `
    <div class="status-topo">
      <span class="ico">${s.icone}</span>
      <div><h2>${esc(s.nome)}</h2><p>${esc(sub)}</p></div>
    </div>
    ${p.status === 'saiu' ? `<div class="barra" style="margin-top:14px"><i style="width:${Math.round(progressoEntrega(p) * 100)}%"></i></div>` : ''}`;
}

function telaPedido(r) {
  const p = pedidos.find((x) => x.id === r.param);
  if (!p) return { topo: topoMini('Pedido'), html: '<div class="vazio"><span class="grande">🔎</span>Pedido não encontrado.</div>' };
  const a = acougue(p.acougue_id);
  const pagNome = { pix: 'Pix', cartao: 'Cartão de crédito', dinheiro: 'Dinheiro na entrega' }[p.pagamento] || p.pagamento;
  return {
    topo: topoMini(`Pedido #${p.numero}`),
    html: `
      <div class="cartao" id="ped-status">${htmlStatus(p)}</div>
      <div class="mapa-cliente" id="mapa"></div>
      <div class="cartao"><ul class="timeline" id="ped-timeline">${htmlTimeline(p)}</ul></div>
      <div class="cartao">
        <div class="secao-titulo" style="margin-bottom:6px"><h2>${a.icone} ${esc(a.nome)}</h2></div>
        ${p.itens.map((i) => `<div class="item-car"><div><strong>${i.qtd}× ${esc(i.nome)}</strong><small>${esc(i.peso || '')}</small></div><b>${dinheiro(i.preco * i.qtd)}</b></div>`).join('')}
        <div class="resumo" style="margin-top:10px">
          <div><span>Entrega</span><span>${dinheiro(p.taxa)}</span></div>
          <div class="total"><span>Total · ${esc(pagNome)}</span><span>${dinheiro(p.total)}</span></div>
        </div>
        <p class="aviso-demo" style="margin-top:10px">📍 ${esc(p.endereco)}</p>
      </div>`,
    depois() {
      mapa = new MapaEntrega(document.getElementById('mapa'), { zoomControl: false });
      mapa.mostrar(p);
    },
  };
}

function atualizarAcompanhamento(p) {
  const st = document.getElementById('ped-status');
  const tl = document.getElementById('ped-timeline');
  if (st) st.innerHTML = htmlStatus(p);
  if (tl) tl.innerHTML = htmlTimeline(p);
  mapa?.mostrar(p);
}

function telaPedidos() {
  const meus = meusPedidos();
  if (!meus.length) {
    return { topo: topoMini('Meus pedidos'), html: '<div class="vazio"><span class="grande">🧾</span><b>Você ainda não fez pedidos</b><a class="btn btn-pri" href="#/acougues">Fazer o primeiro</a></div>' };
  }
  return {
    topo: topoMini('Meus pedidos'),
    html: `<div class="lista">${meus.map((p) => {
      const a = acougue(p.acougue_id);
      const n = p.itens.reduce((s, i) => s + i.qtd, 0);
      return `<a class="loja" href="#/pedido/${p.id}">
        <div class="ico">${a?.icone || '🥩'}</div>
        <div><strong>Pedido #${p.numero} · ${esc(a?.nome || '')}</strong>
          <small>${new Date(p.criado_em).toLocaleDateString('pt-BR')} ${hora(p.criado_em)} · ${n} ${n === 1 ? 'item' : 'itens'} · ${dinheiro(p.total)}</small>
          <div class="meta"><span class="selo selo-${p.status}">${STATUS[p.status].icone} ${STATUS[p.status].curto}</span></div></div></a>`;
    }).join('')}</div>`,
  };
}

function proximaEntrega(dia) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== dia) d.setDate(d.getDate() + 1);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
const dataBR = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '');

function telaAssinatura() {
  const ativa = minhaAssinatura();
  if (ativa) {
    const pl = plano(ativa.plano_id);
    const a = acougue(ativa.acougue_id);
    const pausada = ativa.status === 'pausada';
    return {
      topo: topoMini('Assinatura'),
      html: `
        <div class="assin-ativa">
          <span style="font-size:2.4rem">${pl.icone}</span>
          <h2>Plano ${esc(pl.nome)}</h2>
          <span class="selo" style="justify-self:start;background:${pausada ? '#fff3cd' : '#d1fae5'};color:${pausada ? '#7a5200' : '#065f46'}">${pausada ? '⏸ Pausada' : '✅ Ativa'}</span>
          <div class="linha"><span>O que vem</span><span>${esc(pl.desc)}</span></div>
          <div class="linha"><span>Frequência</span><span>${esc(frequencia(ativa.frequencia).nome)} · ${DIAS_SEMANA[ativa.dia_semana]}</span></div>
          <div class="linha"><span>Açougue</span><span>${esc(a.nome)}</span></div>
          <div class="linha"><span>Próxima entrega</span><span>${pausada ? '—' : dataBR(ativa.proxima_entrega)}</span></div>
          <div class="linha"><span>Valor por entrega</span><span>${dinheiro(pl.preco)}</span></div>
        </div>
        <button class="btn btn-ama btn-bloco" data-acao="pausar">${pausada ? '▶️ Retomar assinatura' : '⏸ Pausar assinatura'}</button>
        <button class="btn btn-sec btn-bloco" data-acao="cancelar-assin">Cancelar assinatura</button>
        <p class="aviso-demo">Demonstração: a assinatura não gera cobrança.</p>`,
    };
  }
  const pl = plano(escolha.plano);
  const fr = frequencia(escolha.freq);
  return {
    topo: topoMini('Assinatura'),
    html: `
      <div class="cartao" style="display:grid;gap:6px">
        <h2 style="font-size:1.25rem;font-weight:900">🔄 Carne fresca sem precisar lembrar</h2>
        <p style="margin:0;color:var(--muted);font-weight:600">Escolha o plano, a frequência e o dia. O açougue separa e entrega sozinho.</p>
      </div>
      <section style="display:grid;gap:10px"><h2 style="font-size:1.05rem;font-weight:900">1. Plano</h2>
        <div class="planos">${PLANOS.map((p) => `
          <button class="plano ${escolha.plano === p.id ? 'ativo' : ''}" data-acao="plano" data-id="${p.id}">
            ${p.destaque ? '<span class="fita">MAIS ESCOLHIDO</span>' : ''}
            <span class="ico">${p.icone}</span><span><strong>${esc(p.nome)}</strong><small>${esc(p.desc)}</small></span>
            <span class="preco">${dinheiro(p.preco)}<small><br>por entrega</small></span></button>`).join('')}
        </div></section>
      <section style="display:grid;gap:10px"><h2 style="font-size:1.05rem;font-weight:900">2. Frequência</h2>
        <div class="chips">${FREQUENCIAS.map((f) => `<button class="chip ${escolha.freq === f.id ? 'ativo' : ''}" data-acao="freq" data-id="${f.id}">${f.nome}</button>`).join('')}</div></section>
      <section style="display:grid;gap:10px"><h2 style="font-size:1.05rem;font-weight:900">3. Dia da entrega</h2>
        <div class="chips">${[1, 2, 3, 4, 5, 6].map((d) => `<button class="chip ${escolha.dia === d ? 'ativo' : ''}" data-acao="dia" data-id="${d}">${DIAS_SEMANA[d].slice(0, 3)}</button>`).join('')}</div></section>
      <section style="display:grid;gap:10px"><h2 style="font-size:1.05rem;font-weight:900">4. Açougue</h2>
        <div class="chips">${ACOUGUES.map((a) => `<button class="chip ${escolha.acougue === a.id ? 'ativo' : ''}" data-acao="assin-acougue" data-id="${a.id}">${a.icone} ${esc(a.nome)}</button>`).join('')}</div></section>
      <div class="cartao resumo">
        <div><span>Plano ${esc(pl.nome)}</span><span>${dinheiro(pl.preco)}</span></div>
        <div><span>Entrega</span><span>${fr.nome.toLowerCase()} · ${DIAS_SEMANA[escolha.dia].toLowerCase()}</span></div>
        <div class="total"><span>Primeira entrega</span><span>${dataBR(proximaEntrega(escolha.dia))}</span></div>
      </div>
      <button class="btn btn-pri btn-bloco" data-acao="assinar">Assinar plano ${esc(pl.nome)}</button>
      <p class="aviso-demo">Demonstração: a assinatura não gera cobrança.</p>`,
  };
}

function conta() {
  const fonte = api?.fonte === 'supabase'
    ? 'Supabase · tempo real entre aparelhos'
    : 'Local · só entre abas deste navegador';
  return {
    topo: topoMini('Minha Conta'),
    html: `
      <div class="cartao" style="display:grid;gap:12px">
        <label class="campo">Nome<input id="c-nome" value="${esc(cliente?.nome || '')}"></label>
        <label class="campo">Endereço de entrega<input id="c-end" value="${esc(cliente?.endereco || '')}"></label>
        <button class="btn btn-pri" data-acao="salvar-conta">Salvar</button>
      </div>
      <div class="cartao">
        <div class="opcao"><span>Tema<small>Claro ou escuro</small></span><button class="btn btn-sec" data-tema-btn></button></div>
        <a class="opcao" href="#/pedidos"><span>Meus pedidos<small>${meusPedidos().length} pedido(s)</small></span><span>→</span></a>
        <a class="opcao" href="#/assinatura"><span>Minha assinatura<small>${minhaAssinatura() ? 'Ativa' : 'Nenhuma'}</small></span><span>→</span></a>
      </div>
      <div class="cartao">
        <div class="opcao"><span>Telas da demonstração<small>Abra em outro aparelho ou aba</small></span></div>
        <a class="opcao" href="acougue.html" target="_blank" rel="noopener"><span>🔪 Painel do açougue</span><span>↗</span></a>
        <a class="opcao" href="monitor.html" target="_blank" rel="noopener"><span>📺 Monitor da TV</span><span>↗</span></a>
        <div class="opcao"><span>Dados<small>${esc(fonte)}</small></span></div>
        <button class="opcao" data-acao="zerar" style="border:0;background:none;width:100%;color:#c62828"><span>🧹 Zerar demonstração<small>Apaga pedidos e assinaturas de todos</small></span><span>→</span></button>
      </div>
      <p class="aviso-demo">CortaÊ · demonstração do TCC · versão ${CONFIG.RELEASE}</p>`,
  };
}

const VIEWS = {
  inicio, acougues: listaAcougues, acougue: telaAcougue, categorias, categoria, busca,
  carrinho: telaCarrinho, pedido: telaPedido, pedidos: telaPedidos, assinatura: telaAssinatura, conta,
};

// ---------- Ações ----------
function atualizarControle(id) {
  document.querySelectorAll(`[data-ctl="${id}"]`).forEach((el) => { el.innerHTML = controle(id); });
}

async function adicionar(id) {
  const p = produto(id);
  if (carrinho.acougue_id && carrinho.acougue_id !== p.acougue && totalItens() > 0) {
    const ok = await confirmar({
      titulo: 'Trocar de açougue?',
      texto: `Seu carrinho tem itens do ${acougue(carrinho.acougue_id).nome}. Cada pedido é de um açougue só; para pedir no ${acougue(p.acougue).nome}, o carrinho será esvaziado.`,
      ok: 'Esvaziar e adicionar',
    });
    if (!ok) return;
    const antigos = Object.keys(carrinho.itens);
    carrinho = { acougue_id: null, itens: {} };
    antigos.forEach(atualizarControle);
  }
  carrinho.acougue_id = p.acougue;
  carrinho.itens[id] = (carrinho.itens[id] || 0) + 1;
  salvarCarrinho();
  atualizarControle(id);
  if (carrinho.itens[id] === 1) toast(`${p.nome} no carrinho 🛒`, 'ok');
  if (rota().nome === 'carrinho') render();
}

function remover(id) {
  if (!carrinho.itens[id]) return;
  carrinho.itens[id] -= 1;
  if (carrinho.itens[id] <= 0) delete carrinho.itens[id];
  if (!totalItens()) carrinho.acougue_id = null;
  salvarCarrinho();
  atualizarControle(id);
  if (rota().nome === 'carrinho') render();
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function finalizar(botao) {
  botao.disabled = true;
  const endereco = document.getElementById('endereco').value.trim() || cliente.endereco;
  cliente.endereco = endereco;
  LS.set('cortae.cliente', cliente);
  const a = acougue(carrinho.acougue_id);
  const itens = Object.entries(carrinho.itens).map(([id, qtd]) => {
    const p = produto(id);
    return { produto_id: id, nome: p.nome, peso: p.peso, icone: p.icone, qtd, preco: p.preco };
  });
  const subtotal = round2(itens.reduce((s, i) => s + i.preco * i.qtd, 0));
  const dados = {
    cliente_id: cliente.id, cliente_nome: cliente.nome, endereco, acougue_id: a.id, itens,
    subtotal, taxa: a.taxa, total: round2(subtotal + a.taxa), pagamento: escolha.pagamento,
  };
  const tela = document.createElement('div');
  tela.className = 'processando';
  tela.innerHTML = `<div class="roda"></div><h2>${escolha.pagamento === 'dinheiro' ? 'Enviando pedido…' : 'Processando pagamento…'}</h2>`;
  document.body.appendChild(tela);
  let pedido;
  try {
    [pedido] = await Promise.all([api.criarPedido(dados), esperar(1400)]);
  } catch (e) {
    tela.remove();
    botao.disabled = false;
    toast(`Não deu para enviar o pedido: ${e.message}`, 'erro');
    return;
  }
  tela.innerHTML = `<div class="certo">✅</div><h2>${escolha.pagamento === 'dinheiro' ? 'Pedido enviado!' : 'Pagamento aprovado!'}</h2><p style="margin:0;font-weight:700">Pedido #${pedido.numero} · ${esc(a.nome)}</p>`;
  statusVistos.set(pedido.id, pedido.status);
  carrinho = { acougue_id: null, itens: {} };
  salvarCarrinho();
  await recarregar();
  if (!pedidos.some((p) => p.id === pedido.id)) pedidos.unshift(pedido);
  await esperar(1100);
  location.hash = `#/pedido/${pedido.id}`;
  tela.remove();
}

async function assinar() {
  const a = await api.criarAssinatura({
    cliente_id: cliente.id, cliente_nome: cliente.nome, endereco: cliente.endereco,
    plano_id: escolha.plano, frequencia: escolha.freq, dia_semana: escolha.dia, acougue_id: escolha.acougue,
    proxima_entrega: proximaEntrega(escolha.dia),
  });
  await recarregar();
  if (!assinaturas.some((x) => x.id === a.id)) assinaturas.unshift(a);
  toast('Assinatura ativada! 🎉', 'ok');
  render();
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-acao]');
  if (!el) return;
  const { acao, id } = el.dataset;
  switch (acao) {
    case 'add': return adicionar(id);
    case 'menos': return remover(id);
    case 'voltar': if (history.length > 1) history.back(); else location.hash = '#/'; return;
    case 'ir-busca': location.hash = '#/busca'; return;
    case 'pagamento':
      escolha.pagamento = id;
      document.querySelectorAll('.pagamento').forEach((b) => b.classList.toggle('ativo', b.dataset.id === id));
      return;
    case 'finalizar': return finalizar(el);
    case 'plano': escolha.plano = id; return render();
    case 'freq': escolha.freq = id; return render();
    case 'dia': escolha.dia = Number(id); return render();
    case 'assin-acougue': escolha.acougue = id; return render();
    case 'assinar': el.disabled = true; return assinar().catch((err) => { el.disabled = false; throw err; });
    case 'pausar': {
      const a = minhaAssinatura();
      const pausar = a.status === 'ativa';
      await api.atualizarAssinatura(a.id, pausar
        ? { status: 'pausada' }
        : { status: 'ativa', proxima_entrega: proximaEntrega(a.dia_semana) });
      await recarregar();
      toast(pausar ? 'Assinatura pausada' : 'Assinatura retomada', 'ok');
      return render();
    }
    case 'cancelar-assin': {
      const ok = await confirmar({ titulo: 'Cancelar a assinatura?', texto: 'Você pode assinar de novo quando quiser.', ok: 'Cancelar assinatura', cancelar: 'Manter', perigo: true });
      if (!ok) return;
      await api.atualizarAssinatura(minhaAssinatura().id, { status: 'cancelada' });
      await recarregar();
      return render();
    }
    case 'salvar-conta': {
      cliente.nome = document.getElementById('c-nome').value.trim() || cliente.nome;
      cliente.endereco = document.getElementById('c-end').value.trim() || cliente.endereco;
      LS.set('cortae.cliente', cliente);
      return toast('Dados salvos', 'ok');
    }
    case 'zerar': {
      const ok = await confirmar({ titulo: 'Zerar a demonstração?', texto: 'Apaga todos os pedidos e assinaturas, em todos os aparelhos. A numeração volta para 1.', ok: 'Zerar tudo', perigo: true });
      if (!ok) return;
      await api.zerar();
      carrinho = { acougue_id: null, itens: {} };
      salvarCarrinho();
      statusVistos.clear();
      await recarregar();
      toast('Demonstração zerada', 'ok');
      return render();
    }
    default:
  }
});

// ---------- Dados ao vivo ----------
async function recarregar() {
  [pedidos, assinaturas] = await Promise.all([api.listarPedidos(), api.listarAssinaturas()]);
}

function avisarMudancas() {
  for (const p of meusPedidos()) {
    const antes = statusVistos.get(p.id);
    if (antes && antes !== p.status) {
      const s = STATUS[p.status];
      toast(`${s.icone} Pedido #${p.numero}: ${s.nome}`, p.status === 'recusado' ? 'erro' : 'ok');
      navigator.vibrate?.(180);
    }
    statusVistos.set(p.id, p.status);
  }
}

async function aoMudar() {
  await recarregar();
  avisarMudancas();
  const r = rota();
  if (r.nome === 'pedido') {
    const p = pedidos.find((x) => x.id === r.param);
    if (p && mapa) atualizarAcompanhamento(p); else render();
  } else if (r.nome === 'inicio') {
    const slot = document.getElementById('slot-ativo');
    const ativo = pedidoAtivo();
    if (slot) slot.innerHTML = ativo ? cartaoPedidoAtivo(ativo) : '';
  } else if (r.nome === 'pedidos' || r.nome === 'assinatura') {
    render();
  }
}

function boasVindas() {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'boas-vindas';
    el.innerHTML = `
      <form class="caixa">
        <img src="img/marca.jpg" alt="CortaÊ — Escolha. Peça. Receba!">
        <div class="cartao">
          <h2 style="font-weight:900">Bem-vindo(a)! 👋</h2>
          <label class="campo">Como você se chama?<input id="bv-nome" required placeholder="Seu nome" autocomplete="given-name"></label>
          <label class="campo">Endereço de entrega<input id="bv-end" value="${esc(CLIENTE_PADRAO.endereco)}"></label>
          <button class="btn btn-pri btn-bloco" type="submit">Começar</button>
        </div>
      </form>`;
    el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      cliente = {
        id: novoId(),
        nome: el.querySelector('#bv-nome').value.trim(),
        endereco: el.querySelector('#bv-end').value.trim() || CLIENTE_PADRAO.endereco,
      };
      LS.set('cortae.cliente', cliente);
      el.remove();
      resolve();
    });
    document.body.appendChild(el);
    el.querySelector('#bv-nome').focus();
  });
}

async function iniciar() {
  render();
  api = await db();
  await recarregar();
  meusPedidos().forEach((p) => statusVistos.set(p.id, p.status));
  if (!cliente) await boasVindas();
  render();
  api.ouvir(() => aoMudar().catch((e) => toast(e.message, 'erro')));
  window.addEventListener('hashchange', render);
  setInterval(() => {
    const r = rota();
    if (r.nome !== 'pedido') return;
    const p = pedidos.find((x) => x.id === r.param);
    if (p?.status === 'saiu') atualizarAcompanhamento(p);
  }, 500);
  setInterval(() => concluirEntregasVencidas(api, pedidos).catch(() => {}), 1000);
}

iniciar();
