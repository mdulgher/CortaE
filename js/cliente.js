// App do cliente (celular): catálogo, carrinho, pedido, acompanhamento e assinatura.
import { db, novoId } from './db.js?v=0.3.2';
import { CONFIG } from './config.js?v=0.3.2';
import {
  ACOUGUES, CATEGORIAS, PRODUTOS, PLANOS, FREQUENCIAS, DIAS_SEMANA, STATUS, ETAPAS, CLIENTE_PADRAO,
  EMPRESA, acougue, produto, plano, frequencia, notaAcougue, temperaturaEntrega, substituto,
  PRAZOS, prazo, precoAssinatura, calcularChurrasco,
} from './catalogo.js?v=0.3.2';
import {
  segundosParaAceite, aceiteAtrasado, mmss, estornoDe, minutosDeEntrega, MOTIVOS, estrelas, htmlAvaliacao,
} from './regras.js?v=0.3.2';
import {
  esc, dinheiro, hora, iniciarTema, atualizarBotoesTema, toast, confirmar, vigiarErros, manterTelaAcesa,
} from './ui.js?v=0.3.2';
import { htmlTimeline } from './timeline.js?v=0.3.2';
import { MapaEntrega, segundosRestantes, progressoEntrega, concluirEntregasVencidas } from './entrega.js?v=0.3.2';
import { ic, pintarIcones } from './icones.js?v=0.3.2';
import { agora } from './relogio.js?v=0.3.2';

vigiarErros();
iniciarTema();
pintarIcones();
manterTelaAcesa();
document.addEventListener('touchstart', () => {}, { passive: true }); // o Safari do iPhone só mostra o :active com isto

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
let esgotados = new Set();
let parceiros = [];
let api;
const avaliando = {}; // estrelas escolhidas antes de enviar, por pedido
const extrasVistos = new Map(); // estorno/resposta já avisados, por pedido
let mapa = null;
let slideTimer = null;
const statusVistos = new Map();
let pronto = false;          // dados carregados: antes disso, os botões que gravam esperam
let enderecoDigitado = null; // o que a pessoa digitou no carrinho e ainda não enviou
const escolha = { pagamento: 'pix', plano: 'churrasco', prazo: 'anual', freq: 'quinzenal', dia: 6, acougue: 'boi' };
const festa = { adultos: 10, criancas: 0, acougue: 'prime' }; // calculadora de churrasco

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
  categorias: 'categorias', categoria: 'categorias', pedido: 'pedidos', pedidos: 'pedidos', ajuda: 'pedidos',
  assinatura: 'assinatura', conta: 'conta', sobre: 'conta', churrasco: 'inicio',
};

function render() {
  const r = rota();
  const view = VIEWS[r.nome] || VIEWS.inicio;
  const campoEndereco = document.getElementById('endereco');
  if (campoEndereco) enderecoDigitado = campoEndereco.value; // o +/- do carrinho redesenha a tela
  if (mapa) { mapa.mapa.remove(); mapa = null; }
  clearInterval(slideTimer);
  const out = view(r);
  $topo.className = 'topo';
  $topo.innerHTML = out.topo;
  $tela.innerHTML = out.html;
  $abas.querySelectorAll('.aba').forEach((a) => {
    const ativa = a.dataset.aba === ABA_DE[r.nome];
    a.classList.toggle('ativa', ativa);
    if (ativa) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  atualizarBotoesTema();
  atualizarBadge();
  out.depois?.();
}

// ---------- Topo ----------
const botaoCarrinho = `<a class="icone-btn" href="#/carrinho" aria-label="Carrinho">${ic('carrinho')}<span class="badge oculto" data-badge></span></a>`;

function topoGrande() {
  return `
    <div class="topo-linha">
      <div class="topo-acoes">
        <a class="icone-btn" href="#/conta" aria-label="Minha conta">${ic('menu')}</a>
        <button class="icone-btn" data-tema-btn></button>
      </div>
      <img class="logo-img" src="img/logo.jpg" alt="CortaÊ — Escolha. Peça. Receba!">
      <div class="topo-acoes">
        <a class="icone-btn" href="#/pedidos" aria-label="Meus pedidos">${ic('sino')}</a>
        ${botaoCarrinho}
      </div>
    </div>
    <div class="local">${ic('pino')} Entregar em <b>Santos - SP</b></div>
    <button class="busca" data-acao="ir-busca">${ic('busca')} <span>O que você procura?</span></button>`;
}

function topoMini(titulo) {
  return `
    <div class="topo-mini">
      <button class="icone-btn" data-acao="voltar" aria-label="Voltar">${ic('voltar')}</button>
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
  if (!q && esgotados.has(id)) return '<span class="tag-esgotado">Esgotado</span>';
  if (!q) return `<button class="add" data-acao="add" data-id="${id}" aria-label="Adicionar">${ic('mais')}</button>`;
  return `<div class="qtd">
    <button data-acao="menos" data-id="${id}" aria-label="Diminuir">${ic('menos')}</button><span>${q}</span>
    <button data-acao="add" data-id="${id}" aria-label="Aumentar">${ic('mais')}</button></div>`;
}

// Corte esgotado: o app sugere um substituto (ponto crítico da etapa 2 do blueprint).
function htmlSugestao(id) {
  if (!esgotados.has(id)) return '';
  const s = substituto(id, esgotados);
  if (!s) return '<small class="sugestao">Sem substituto no momento</small>';
  const outraLoja = s.acougue !== produto(id).acougue ? ` · ${esc(acougue(s.acougue).nome)}` : '';
  return `<button class="sugestao" data-acao="add" data-id="${s.id}">Sugestão: <b>${esc(s.nome)}</b>${outraLoja} · ${dinheiro(s.preco)} ${ic('mais', 'ic-mini')}</button>`;
}

function cartaoProduto(p, mostrarLoja = false) {
  return `
    <div class="prod ${esgotados.has(p.id) ? 'prod-esgotado' : ''}">
      <div class="prod-ico cat-${p.cat}">${p.icone}</div>
      <div class="prod-info">
        <strong>${esc(p.nome)}</strong>
        <small>${esc(p.peso)}</small>
        ${mostrarLoja ? `<small class="loja-nome">${esc(acougue(p.acougue).nome)}</small>` : ''}
        <span class="preco">${dinheiro(p.preco)}</span>
        ${htmlSugestao(p.id)}
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
        ${meta(a)}
      </div>
    </a>`;
}

function meta(a, prefixoTaxa = '') {
  const { nota } = notaAcougue(a, pedidos);
  return `<div class="meta"><span class="estrela">★ ${nota.toFixed(1).replace('.', ',')}</span><span>${ic('relogio', 'ic-mini')} ${a.tempo}</span><span>${ic('moto', 'ic-mini')} ${prefixoTaxa}${dinheiro(a.taxa)}</span></div>`;
}

function cartaoPedidoAtivo(p) {
  const s = STATUS[p.status];
  return `
    <a class="pedido-ativo" href="#/pedido/${p.id}">
      <span class="ico">${s.icone}</span>
      <span>Pedido #${p.numero} · ${esc(s.nome)}<small>${esc(acougue(p.acougue_id)?.nome || '')} · toque para acompanhar</small></span>
      ${ic('seta')}
    </a>`;
}

// ---------- Telas ----------
// Lembrete de recompra (etapa 6 do blueprint): o último pedido entregue, a um toque.
function cartaoRecompra() {
  const ultimo = meusPedidos().find((p) => p.status === 'entregue');
  if (!ultimo || pedidoAtivo()) return '';
  const a = acougue(ultimo.acougue_id);
  const n = ultimo.itens.reduce((s, i) => s + i.qtd, 0);
  return `
    <div class="recompra">
      <span class="ico">${ic('ciclo')}</span>
      <span>Hora de repor?<small>Pedido #${ultimo.numero} · ${esc(a.nome)} · ${n} ${n === 1 ? 'item' : 'itens'}</small></span>
      <button class="btn btn-ama" data-acao="repetir" data-id="${ultimo.id}">Pedir de novo</button>
    </div>`;
}
const slotAtivo = () => { const ativo = pedidoAtivo(); return ativo ? cartaoPedidoAtivo(ativo) : cartaoRecompra(); };

function inicio() {
  const destaques = PRODUTOS.filter((p) => p.destaque);
  return {
    topo: topoGrande(),
    html: `
      <div id="slot-ativo">${slotAtivo()}</div>
      <div class="atalhos">
        <a class="atalho atalho-1" href="#/acougues"><span class="ico">${ic('carne')}</span>Açougues</a>
        <a class="atalho atalho-2" href="#/categoria/kits"><span class="ico">${ic('caixa')}</span>Kits</a>
        <a class="atalho atalho-3" href="#/assinatura"><span class="ico">${ic('ciclo')}</span>Assinatura</a>
        <a class="atalho atalho-4" href="#/categoria/outros"><span class="ico">${ic('cesta')}</span>Outros Produtos</a>
      </div>
      <div class="carrossel">
        <div class="slides" id="slides">
          <div class="slide">
            <h3>Kits <b>Especiais</b></h3>
            <p>Praticidade e qualidade na sua mesa!</p>
            <a class="btn btn-ama" href="#/categoria/kits">Ver kits</a>
            <img src="img/banner-carne.jpg" alt="">
          </div>
          <div class="slide slide-2">
            <h3>Assine e <b>ganhe um kit</b></h3>
            <p>Anual 10% mais barato e Kit Churrasco de presente ao renovar.</p>
            <a class="btn btn-pri" href="#/assinatura">Ver promoção</a>
            <span class="arte">${ic('ciclo')}</span>
          </div>
          <div class="slide slide-3">
            <h3>Churrasco <b>de sábado</b></h3>
            <p>Diga quantas pessoas vão e a gente calcula o pedido.</p>
            <a class="btn btn-pri" href="#/churrasco">Calcular</a>
            <span class="arte">🔥</span>
          </div>
        </div>
        <div class="pontos" id="pontos"><i class="ativo"></i><i></i><i></i></div>
      </div>
      <a class="conheca calc-atalho" href="#/churrasco"><span><b>🔥 Calculadora de churrasco</b><small>Quanto de carne, carvão e acompanhamentos pedir</small></span>${ic('seta')}</a>
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
      </section>
      <a class="conheca" href="#/sobre">
        <span><b>Conheça o CortaÊ</b><small>Açougues verificados, embalagem térmica lacrada e atendimento no app</small></span>${ic('seta')}
      </a>`,
    depois: iniciarCarrossel,
  };
}

function iniciarCarrossel() {
  const slides = document.getElementById('slides');
  const pontos = [...document.querySelectorAll('#pontos i')];
  if (!slides) return;
  const atual = () => Math.round(slides.scrollLeft / slides.clientWidth);
  slides.addEventListener('scroll', () => pontos.forEach((p, i) => p.classList.toggle('ativo', i === atual())), { passive: true });
  // Não anda sozinho para quem pediu menos movimento, e para de vez quando a pessoa desliza com o dedo.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  slides.addEventListener('pointerdown', () => clearInterval(slideTimer), { once: true });
  slideTimer = setInterval(() => {
    const prox = (atual() + 1) % pontos.length;
    slides.scrollTo({ left: prox * slides.clientWidth, behavior: 'smooth' });
  }, 4500);
}

function listaAcougues() {
  // Açougues que terminaram o cadastro na página "Seja parceiro" aparecem como novidade.
  const novos = parceiros.filter((c) => c.status === 'ativo').map((c) => `
    <div class="loja loja-nova">
      <div class="ico">🆕</div>
      <div><strong>${esc(c.dados?.nome || 'Novo parceiro')} <span class="verificado" title="Parceiro verificado">✔︎</span></strong>
        <small>Acabou de entrar no CortaÊ · vitrine chegando em breve</small>
        <div class="meta"><span>${ic('pino', 'ic-mini')} ${esc(c.dados?.bairro || 'Santos')}</span></div></div>
    </div>`).join('');
  return { topo: topoMini('Açougues'), html: `<div class="lista">${ACOUGUES.map(cartaoLoja).join('')}${novos}</div>
    <a class="conheca" href="parceiro.html"><span><b>Tem um açougue em Santos?</b><small>Seja parceiro do CortaÊ</small></span>${ic('seta')}</a>` };
}

function htmlAvaliacoesLoja(a) {
  const { nota, qtd } = notaAcougue(a, pedidos);
  const recentes = pedidos.filter((p) => p.acougue_id === a.id && p.extras?.avaliacao).slice(0, 5);
  return `
    <section>
      <div class="secao-titulo"><h2>Avaliações</h2><span class="nota-grande">${estrelas(nota)} ${nota.toFixed(1).replace('.', ',')} · ${qtd}</span></div>
      ${recentes.length ? recentes.map((p) => `
        <div class="cartao aval-item">
          <div class="secao-titulo"><b>${esc(p.cliente_nome)}</b><small>${new Date(p.extras.avaliacao.em).toLocaleDateString('pt-BR')}</small></div>
          ${htmlAvaliacao(p.extras.avaliacao)}
        </div>`).join('') : '<p class="aviso-demo" style="text-align:left">As avaliações feitas depois da entrega aparecem aqui.</p>'}
    </section>`;
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
        <small>${esc(a.endereco)} · Santos - SP</small>
        ${meta(a, 'Entrega ')}
        <div class="selos-loja">
          <span>${ic('check', 'ic-mini')} Parceiro verificado</span>
          <span>🏛️ Alvará e licença sanitária</span>
          <span>🔎 Carne com selo ${esc(a.inspecao.split(' ')[0])}</span>
          <span>🧊 Embalagem térmica lacrada</span>
        </div>
      </div>
      <div class="chips chips-rolar">${chip('todos', 'Todos')}${CATEGORIAS.map((c) => chip(c.id, `${c.icone} ${c.nome}`)).join('')}</div>
      <div class="lista">${prods.map((p) => cartaoProduto(p)).join('')}</div>
      ${htmlAvaliacoesLoja(a)}
      <div class="cartao vendedor">
        <h2 class="subtitulo">Quem vende</h2>
        <div class="linha"><span>Razão social</span><span>${esc(a.razao)}</span></div>
        <div class="linha"><span>CNPJ</span><span>${esc(a.cnpj)}</span></div>
        <div class="linha"><span>Licença sanitária</span><span>${esc(a.licenca)}</span></div>
        <div class="linha"><span>Origem da carne</span><span>${esc(a.inspecao)}</span></div>
        <div class="linha"><span>Intermediado por</span><span>${esc(EMPRESA.razao)} · CNPJ ${esc(EMPRESA.cnpj)}</span></div>
        <p class="aviso-demo">Dados fictícios da demonstração. Identificação exigida pelo Decreto 7.962/2013 (comércio eletrônico).</p>
      </div>`,
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
      <label class="busca">${ic('busca')} <input id="q" placeholder="O que você procura?" value="${esc(q)}" autocomplete="off"></label>
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
        ${itens.map(({ p, qtd }) => {
    if (esgotados.has(p.id)) {
      const s = substituto(p.id, esgotados);
      const mesmaLoja = s && s.acougue === p.acougue;
      return `
          <div class="item-car item-esgotado">
            <div><strong>${esc(p.nome)}</strong><small class="alerta-txt">Esgotou agora no açougue</small>
              ${mesmaLoja ? `<button class="sugestao" data-acao="trocar" data-id="${p.id}" data-sub="${s.id}">Trocar por <b>${esc(s.nome)}</b> · ${dinheiro(s.preco)}</button>` : ''}</div>
            <button class="btn btn-sec" data-acao="tirar" data-id="${p.id}">Remover</button>
          </div>`;
    }
    return `
          <div class="item-car">
            <div><strong>${esc(p.nome)}</strong><small>${esc(p.peso)} · ${dinheiro(p.preco)}</small><small><b>${dinheiro(p.preco * qtd)}</b></small></div>
            <div data-ctl="${p.id}">${controle(p.id)}</div>
          </div>`;
  }).join('')}
      </div>
      <div class="cartao"><label class="campo">Entregar em
        <input id="endereco" maxlength="120" value="${esc(enderecoDigitado ?? (cliente?.endereco || CLIENTE_PADRAO.endereco))}"></label></div>
      <div class="cartao" style="display:grid;gap:10px">
        <h2 class="subtitulo">Pagamento</h2>
        <div class="pagamentos">
          ${pag('pix', '⚡', 'Pix', 'Aprovação na hora')}
          ${pag('cartao', '💳', 'Cartão de crédito', 'Final 4242')}
          ${pag('dinheiro', '💵', 'Dinheiro na entrega', 'Leve troco para R$ 200')}
        </div>
        <p class="aviso-demo">🔒 Pagamento com checagem antifraude. Demonstração: nenhum valor é cobrado de verdade.</p>
      </div>
      <div class="cartao garantias">
        <span>🧊 Embalagem térmica lacrada</span>
        <span>${ic('relogio', 'ic-mini')} Entrega em até ${CONFIG.ENTREGA_MAX_MIN} min</span>
        <span>💬 Atendimento no app</span>
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
  const est = estornoDe(p);
  const seg = segundosParaAceite(p);
  const sub = {
    recebido: aceiteAtrasado(p)
      ? `O ${a.nome} está demorando para aceitar. A equipe CortaÊ já foi avisada e está cuidando disso.`
      : `Aguardando o ${a.nome} confirmar · prazo de aceite ${mmss(seg)}`,
    preparando: `O ${a.nome} está separando seus cortes e lacrando a embalagem térmica`,
    saiu: `Embalagem térmica lacrada · motoboy a caminho · chega em ${segundosRestantes(p)}s`,
    entregue: `Entregue às ${hora(p.entregue_em)}, em ${minutosDeEntrega(p)} min (prazo máximo de ${CONFIG.ENTREGA_MAX_MIN} min). Bom apetite! 🍖`,
    recusado: est
      ? `O açougue não pôde atender. Estorno de ${dinheiro(est.valor)} feito no ${p.pagamento === 'pix' ? 'Pix' : 'cartão'}.`
      : 'O açougue não pôde atender. Nada foi cobrado.',
  }[p.status];
  return `
    <div class="status-topo ${p.status === 'recebido' && aceiteAtrasado(p) ? 'status-alerta' : ''}">
      <span class="ico">${s.icone}</span>
      <div><h2>${esc(s.nome)}</h2><p>${esc(sub)}</p></div>
    </div>
    ${p.status === 'saiu' ? `<div class="barra" style="margin-top:14px"><i style="width:${Math.round(progressoEntrega(p) * 100)}%"></i></div>` : ''}
    ${p.status === 'entregue' ? `<div class="selo-termico">🧊 Embalagem térmica lacrada · ${temperaturaEntrega(p)} °C na entrega (regra: até 4 °C)</div>` : ''}
    ${p.extras?.estorno ? `<div class="selo-estorno">↩︎ Estorno de ${dinheiro(p.extras.estorno.valor)} aprovado · ${esc(p.extras.estorno.motivo)}</div>` : ''}`;
}

// Depois da entrega: conferir, avaliar e pedir de novo (etapas 5 e 6 do blueprint).
function chavePos(p) {
  const e = p.extras || {};
  return [p.status, !!e.conferido_em, !!e.avaliacao, !!e.reclamacao, !!e.estorno].join('|');
}
function htmlPosEntrega(p) {
  const e = p.extras || {};
  const ajuda = `<a class="btn btn-sec btn-bloco" href="#/ajuda/${p.id}">💬 Ajuda com o pedido</a>`;
  if (p.status === 'recusado') {
    return `<button class="btn btn-pri btn-bloco" data-acao="repetir" data-id="${p.id}">Pedir em outro açougue</button>${ajuda}`;
  }
  if (p.status !== 'entregue') return ajuda;
  if (!e.conferido_em) {
    return `
      <div class="cartao receber">
        <h2 class="subtitulo">Confira o seu pedido</h2>
        <ul class="checklist">
          <li>🧊 Embalagem térmica com o lacre intacto</li>
          <li>🌡️ Carne gelada (${temperaturaEntrega(p)} °C medidos na entrega)</li>
          <li>📦 ${p.itens.reduce((s, i) => s + i.qtd, 0)} itens, conforme o pedido</li>
        </ul>
        <button class="btn btn-ok btn-bloco" data-acao="conferir" data-id="${p.id}">${ic('check')} Recebi e conferi</button>
      </div>${ajuda}`;
  }
  if (!e.avaliacao) {
    const sel = avaliando[p.id] || {};
    const linha = (campo, rotulo) => `
      <div class="linha-estrelas"><span>${rotulo}</span><span class="estrelas-escolha">${[1, 2, 3, 4, 5].map((n) => `
        <button class="${(sel[campo] || 0) >= n ? 'on' : ''}" data-acao="estrela" data-id="${p.id}" data-campo="${campo}" data-n="${n}" aria-label="${n} estrela${n > 1 ? 's' : ''}">★</button>`).join('')}</span></div>`;
    return `
      <div class="cartao avaliar">
        <h2 class="subtitulo">Como foi?</h2>
        ${linha('acougue', `${esc(acougue(p.acougue_id).nome)}`)}
        ${linha('entrega', 'Entrega')}
        <textarea id="aval-coment" maxlength="200" rows="2" placeholder="Conte o que achou (opcional)"></textarea>
        <button class="btn btn-pri btn-bloco" data-acao="avaliar" data-id="${p.id}">Enviar avaliação</button>
      </div>${ajuda}`;
  }
  return `
    <div class="cartao avaliado">
      <h2 class="subtitulo">Obrigado pela avaliação! 🙌</h2>
      ${htmlAvaliacao(e.avaliacao)}
      <button class="btn btn-ama btn-bloco" data-acao="repetir" data-id="${p.id}">${ic('ciclo')} Pedir de novo</button>
    </div>${ajuda}`;
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
      <div id="ped-pos" class="pos-entrega" data-chave="${chavePos(p)}">${htmlPosEntrega(p)}</div>
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
  // Só redesenha o bloco de baixo quando a etapa muda, para não apagar as estrelas ou o comentário em andamento.
  const pos = document.getElementById('ped-pos');
  if (pos && pos.dataset.chave !== chavePos(p)) { pos.dataset.chave = chavePos(p); pos.innerHTML = htmlPosEntrega(p); }
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
          <div class="meta"><span class="selo selo-${p.status}">${STATUS[p.status].icone} ${STATUS[p.status].curto}</span>
            ${p.extras?.avaliacao ? `<span>${estrelas(p.extras.avaliacao.acougue)}</span>` : ''}
            ${estornoDe(p) ? '<span class="selo selo-recusado">↩︎ Estornado</span>' : ''}</div></div></a>`;
    }).join('')}</div>`,
  };
}

function proximaEntrega(dia) {
  const d = new Date(agora());
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== dia) d.setDate(d.getDate() + 1);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
const dataBR = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '');

// ---------- Calculadora de churrasco ----------
// Quanto pedir para N pessoas; o que estiver esgotado no açougue vira o substituto sugerido.
function contaChurrasco() {
  const c = calcularChurrasco(festa.adultos, festa.criancas, festa.acougue);
  c.linhas.forEach((l) => {
    if (esgotados.has(l.produto.id)) {
      const sub = substituto(l.produto.id, esgotados);
      l.trocadoDe = l.produto.nome;
      l.produto = sub && sub.acougue === festa.acougue ? sub : null;
      l.subtotal = l.produto ? round2(l.emb * l.produto.preco) : 0;
    }
  });
  c.total = round2(c.linhas.reduce((s, l) => s + l.subtotal, 0));
  return c;
}

function telaChurrasco() {
  const c = contaChurrasco();
  const passo = (campo, rotulo, sub) => `
    <div class="contador"><span><b>${rotulo}</b><small>${sub}</small></span>
      <div class="qtd">
        <button data-acao="festa" data-campo="${campo}" data-d="-1" aria-label="Menos ${rotulo.toLowerCase()}">${ic('menos')}</button>
        <span>${festa[campo]}</span>
        <button data-acao="festa" data-campo="${campo}" data-d="1" aria-label="Mais ${rotulo.toLowerCase()}">${ic('mais')}</button>
      </div></div>`;
  return {
    topo: topoMini('Calculadora de churrasco'),
    html: `
      <div class="intro-assin">
        <h2>🔥 Quanto pedir?</h2>
        <p>Diga quantas pessoas vão. A gente calcula a carne e o resto: carvão, sal, pão de alho e farofa.</p>
      </div>
      <div class="cartao calc-pessoas">
        ${passo('adultos', 'Adultos', '~400 g de carne cada')}
        ${passo('criancas', 'Crianças', '~200 g de carne cada')}
      </div>
      <section><h2 class="passo"><i>🔪</i>Açougue</h2>
        <div class="chips">${ACOUGUES.map((a) => `<button class="chip ${festa.acougue === a.id ? 'ativo' : ''}" data-acao="festa-acougue" data-id="${a.id}">${a.icone} ${esc(a.nome)}</button>`).join('')}</div></section>
      ${c.pessoas ? `
      <div class="cartao calc-result">
        <div class="calc-topo"><span>${c.pessoas} ${c.pessoas === 1 ? 'pessoa' : 'pessoas'}</span><b>${c.kgCarne.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg de carne</b></div>
        ${c.linhas.map((l) => `
          <div class="calc-linha ${l.carne ? '' : 'calc-outro'}">
            <span class="prod-ico cat-${l.produto?.cat || 'outros'}">${l.produto?.icone || '✖️'}</span>
            <span><strong>${l.produto ? esc(l.produto.nome) : esc(l.trocadoDe)}</strong>
              <small>${l.carne ? '' : `precisa de ${l.precisa} · `}${l.emb}× ${esc((l.produto?.peso || '').toLowerCase())}</small>
              ${l.trocadoDe ? `<small class="calc-troca">${l.produto ? `No lugar de ${esc(l.trocadoDe)}, sem estoque hoje` : 'Sem estoque e sem substituto'}</small>` : ''}</span>
            <span class="preco">${l.produto ? dinheiro(l.subtotal) : '—'}</span>
          </div>`).join('')}
        <div class="calc-total"><span>Total dos itens</span><span>${dinheiro(c.total)}</span></div>
      </div>
      <p class="dica-calc">💡 Bebidas não vendemos, mas contem uns 1,5 L por pessoa entre água, refrigerante e cerveja.</p>
      <button class="btn btn-pri btn-bloco" data-acao="churrasco-carrinho">Pôr tudo no carrinho · ${dinheiro(c.total)}</button>`
      : '<div class="vazio"><span class="grande">🍖</span>Coloque pelo menos uma pessoa.</div>'}`,
  };
}

async function churrascoNoCarrinho() {
  const c = contaChurrasco();
  const itens = c.linhas.filter((l) => l.produto && l.emb);
  if (!itens.length) return;
  if (totalItens() > 0) {
    const ok = await confirmar({
      titulo: 'Substituir o carrinho?',
      texto: `O carrinho atual será trocado pelos ${itens.length} itens do churrasco no ${acougue(festa.acougue).nome}.`,
      ok: 'Substituir',
    });
    if (!ok) return;
  }
  carrinho = { acougue_id: festa.acougue, itens: {} };
  itens.forEach((l) => { carrinho.itens[l.produto.id] = (carrinho.itens[l.produto.id] || 0) + l.emb; });
  salvarCarrinho();
  toast('Churrasco no carrinho 🔥', 'ok');
  location.hash = '#/carrinho';
}

// Fim do período contratado: início do período atual + meses do prazo.
function fimDoPeriodo(a) {
  const d = new Date(a.extras?.periodo_inicio || a.criado_em);
  d.setMonth(d.getMonth() + prazo(a.prazo).meses);
  return d.toLocaleDateString('pt-BR');
}
const descontoTxt = (pz) => (pz.desconto ? `−${Math.round(pz.desconto * 100)}%` : 'preço cheio');

function cartaoPresente(ativa) {
  const b = ativa.extras?.brinde;
  if (b?.status === 'pendente') {
    return `<div class="presente presente-pendente"><span class="ico">🎁</span><span><b>Seu presente: ${esc(b.nome)}</b>
      <small>Vai junto com a próxima entrega${ativa.status === 'pausada' ? ' (quando retomar)' : `, em ${dataBR(ativa.proxima_entrega)}`}.</small></span></div>`;
  }
  const pz = prazo(ativa.prazo);
  const ultimo = b?.status === 'entregue' ? `<small>Último presente (${esc(b.nome)}) entregue ✓</small>` : '';
  return `<div class="presente"><span class="ico">${pz.brinde.icone}</span><span><b>Renove em ${fimDoPeriodo(ativa)} e ganhe ${esc(pz.brinde.nome)}</b>
    <small>O presente vai junto com a 1ª entrega do novo período.</small>${ultimo}</span></div>`;
}

function cartoesPrazo(sel, acao) {
  return `<div class="prazos">${PRAZOS.map((pz) => `
    <button class="prazo ${sel === pz.id ? 'ativo' : ''}" data-acao="${acao}" data-id="${pz.id}">
      ${pz.destaque ? '<span class="fita">MAIS BARATO</span>' : ''}
      <strong>${esc(pz.nome)}</strong>
      <span class="desc ${pz.desconto ? '' : 'cheio'}">${descontoTxt(pz)}</span>
      <small>${pz.meses === 1 ? '1 mês' : `${pz.meses} meses`}</small>
      <span class="ganha">🎁 ${esc(pz.brinde.nome)}</span>
    </button>`).join('')}</div>`;
}

function telaAssinatura() {
  const ativa = minhaAssinatura();
  if (ativa) {
    const pl = plano(ativa.plano_id);
    const pz = prazo(ativa.prazo);
    const a = acougue(ativa.acougue_id);
    const pausada = ativa.status === 'pausada';
    const valor = precoAssinatura(ativa.plano_id, ativa.prazo);
    if (!escolha.renovarComo) escolha.renovarComo = pz.id;
    return {
      topo: topoMini('Assinatura'),
      html: `
        <div class="assin-ativa">
          <span class="ico">${pl.icone}</span>
          <h2>Plano ${esc(pl.nome)}</h2>
          <span class="selo ${pausada ? 'selo-recebido' : 'selo-entregue'}" style="justify-self:start">${pausada ? 'Pausada' : `${ic('check', 'ic-mini')} Ativa`}</span>
          <div class="linha"><span>O que vem</span><span>${esc(pl.desc)}</span></div>
          <div class="linha"><span>Prazo</span><span>${esc(pz.nome)} · ${descontoTxt(pz)}</span></div>
          <div class="linha"><span>Período até</span><span>${fimDoPeriodo(ativa)}${ativa.extras?.renovacoes ? ` · ${ativa.extras.renovacoes}ª renovação` : ''}</span></div>
          <div class="linha"><span>Frequência</span><span>${esc(frequencia(ativa.frequencia).nome)} · ${DIAS_SEMANA[ativa.dia_semana]}</span></div>
          <div class="linha"><span>Açougue</span><span>${esc(a.nome)}</span></div>
          <div class="linha"><span>Próxima entrega</span><span>${pausada ? '—' : dataBR(ativa.proxima_entrega)}</span></div>
          <div class="linha"><span>Valor por entrega</span><span>${pz.desconto ? `<s>${dinheiro(pl.preco)}</s> ` : ''}${dinheiro(valor)}</span></div>
        </div>
        ${cartaoPresente(ativa)}
        <section class="renovar"><h2 class="passo"><i>↻</i>Renovar ou mudar o prazo</h2>
          ${cartoesPrazo(escolha.renovarComo, 'renovar-como')}
          <button class="btn btn-pri btn-bloco" data-acao="renovar">Simular renovação · ${esc(prazo(escolha.renovarComo).nome)}</button>
          <p class="aviso-demo">Na vida real a renovação acontece em ${fimDoPeriodo(ativa)}; aqui ela é simulada na hora.</p>
        </section>
        <button class="btn btn-ama btn-bloco" data-acao="pausar">${pausada ? 'Retomar assinatura' : 'Pausar assinatura'}</button>
        <button class="btn btn-sec btn-bloco" data-acao="cancelar-assin">Cancelar assinatura</button>
        <p class="aviso-demo">Demonstração: a assinatura não gera cobrança.</p>`,
    };
  }
  const pl = plano(escolha.plano);
  const pz = prazo(escolha.prazo);
  const fr = frequencia(escolha.freq);
  return {
    topo: topoMini('Assinatura'),
    html: `
      <div class="intro-assin">
        <h2>Carne fresca sem precisar lembrar</h2>
        <p>Escolha o plano, o prazo, a frequência e o dia. O açougue separa e entrega sozinho.</p>
      </div>
      <div class="promo-assin">
        <span class="ico">🎁</span>
        <span><b>Promoção: assine e ganhe um kit</b>
          <small>Semestral 5% mais barato, anual 10%. Ao renovar, você ganha um kit de presente na 1ª entrega do novo período.</small></span>
      </div>
      <section><h2 class="passo"><i>1</i>Plano</h2>
        <div class="planos">${PLANOS.map((p) => `
          <button class="plano ${escolha.plano === p.id ? 'ativo' : ''}" data-acao="plano" data-id="${p.id}">
            ${p.destaque ? '<span class="fita">MAIS ESCOLHIDO</span>' : ''}
            <span class="ico">${p.icone}</span><span><strong>${esc(p.nome)}</strong><small>${esc(p.desc)}</small></span>
            <span class="preco">${dinheiro(precoAssinatura(p.id, escolha.prazo))}<small><br>por entrega</small></span></button>`).join('')}
        </div></section>
      <section><h2 class="passo"><i>2</i>Prazo</h2>${cartoesPrazo(escolha.prazo, 'prazo')}</section>
      <section><h2 class="passo"><i>3</i>Frequência</h2>
        <div class="chips">${FREQUENCIAS.map((f) => `<button class="chip ${escolha.freq === f.id ? 'ativo' : ''}" data-acao="freq" data-id="${f.id}">${f.nome}</button>`).join('')}</div></section>
      <section><h2 class="passo"><i>4</i>Dia da entrega</h2>
        <div class="chips">${[1, 2, 3, 4, 5, 6].map((d) => `<button class="chip ${escolha.dia === d ? 'ativo' : ''}" data-acao="dia" data-id="${d}">${DIAS_SEMANA[d].slice(0, 3)}</button>`).join('')}</div></section>
      <section><h2 class="passo"><i>5</i>Açougue</h2>
        <div class="chips">${ACOUGUES.map((a) => `<button class="chip ${escolha.acougue === a.id ? 'ativo' : ''}" data-acao="assin-acougue" data-id="${a.id}">${a.icone} ${esc(a.nome)}</button>`).join('')}</div></section>
      <div class="cartao resumo">
        <div><span>Plano ${esc(pl.nome)}</span><span>${pz.desconto ? `<s>${dinheiro(pl.preco)}</s> ` : ''}${dinheiro(precoAssinatura(pl.id, pz.id))}</span></div>
        <div><span>Prazo ${esc(pz.nome.toLowerCase())}</span><span>${descontoTxt(pz)}</span></div>
        <div><span>Entrega</span><span>${fr.nome.toLowerCase()} · ${DIAS_SEMANA[escolha.dia].toLowerCase()}</span></div>
        <div><span>Presente ao renovar</span><span>🎁 ${esc(pz.brinde.nome)}</span></div>
        <div class="total"><span>Primeira entrega</span><span>${dataBR(proximaEntrega(escolha.dia))}</span></div>
      </div>
      <button class="btn btn-pri btn-bloco" data-acao="assinar">Assinar plano ${esc(pl.nome)}</button>
      <p class="aviso-demo">Demonstração: a assinatura não gera cobrança.</p>`,
  };
}

// ---------- Atendimento (chat no app e reclamação, etapa 6 do blueprint) ----------
function htmlChat(p) {
  const nome = (cliente?.nome || '').split(' ')[0];
  const msgs = [{ de: 'cortae', texto: `Olá${nome ? `, ${nome}` : ''}! Sou o atendimento CortaÊ. Como posso ajudar com o pedido #${p.numero}?` },
    ...(p.extras?.chat || [])];
  return msgs.map((m) => `<div class="msg msg-${m.de === 'cliente' ? 'eu' : 'cortae'}">${m.de === 'acougue' ? `<b>${esc(acougue(p.acougue_id).nome)}</b>` : ''}${esc(m.texto)}${m.em ? `<small>${hora(m.em)}</small>` : ''}</div>`).join('');
}
function opcoesChat(p) {
  const op = [['onde', 'Onde está meu pedido?']];
  if (p.status === 'entregue' && !p.extras?.reclamacao) {
    op.push(['temperatura', MOTIVOS.temperatura], ['faltou', MOTIVOS.faltou]);
  }
  op.push(['pessoa', 'Falar com uma pessoa']);
  return op.map(([id, t]) => `<button class="chip" data-acao="chat-op" data-id="${p.id}" data-op="${id}">${esc(t)}</button>`).join('');
}
function telaAjuda(r) {
  const p = pedidos.find((x) => x.id === r.param);
  if (!p) return { topo: topoMini('Ajuda'), html: '<div class="vazio">Pedido não encontrado.</div>' };
  return {
    topo: topoMini(`Ajuda · Pedido #${p.numero}`),
    html: `
      <div class="chat" id="chat">${htmlChat(p)}</div>
      <div class="chips" id="chat-op">${opcoesChat(p)}</div>
      <form class="chat-envio" data-id="${p.id}">
        <input id="chat-txt" maxlength="200" placeholder="Escreva sua mensagem" autocomplete="off">
        <button class="btn btn-pri" type="submit">Enviar</button>
      </form>
      <p class="aviso-demo">Demonstração: as respostas do atendimento são automáticas.</p>`,
    depois() {
      const chat = document.getElementById('chat');
      chat.lastElementChild?.scrollIntoView({ block: 'end' });
    },
  };
}
function atualizarChat(p) {
  const chat = document.getElementById('chat');
  const op = document.getElementById('chat-op');
  if (!chat) return;
  const antes = chat.childElementCount;
  chat.innerHTML = htmlChat(p);
  op.innerHTML = opcoesChat(p);
  if (chat.childElementCount !== antes) chat.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' });
}

function respostaOnde(p) {
  const a = acougue(p.acougue_id);
  return {
    recebido: `O ${a.nome} ainda vai aceitar o pedido. Se passar do prazo, nossa equipe cobra o açougue.`,
    preparando: `O ${a.nome} está separando os cortes e lacrando a embalagem térmica.`,
    saiu: `O motoboy está a caminho e chega em cerca de ${segundosRestantes(p)} segundos. Acompanhe no mapa.`,
    entregue: `O pedido foi entregue às ${hora(p.entregue_em)}.`,
    recusado: 'O açougue recusou o pedido. Se você pagou pelo app, o estorno já foi feito.',
  }[p.status];
}

// Grava mensagens em sequência: cada escrita parte do pedido mais novo, para não perder a anterior.
async function falar(p, ...msgs) {
  let atual = p;
  for (const m of msgs) {
    if (m.espera) await esperar(m.espera);
    const fresco = pedidos.find((x) => x.id === atual.id) || atual;
    const extras = { chat: [...(fresco.extras?.chat || []), { de: m.de, texto: m.texto, em: new Date(agora()).toISOString() }], ...(m.extras || {}) };
    atual = await api.atualizarExtras(atual.id, extras);
    const i = pedidos.findIndex((x) => x.id === atual.id);
    if (i >= 0) pedidos[i] = atual;
    if (rota().nome === 'ajuda') atualizarChat(atual);
  }
}

async function opcaoChat(p, op) {
  const a = acougue(p.acougue_id);
  if (op === 'onde') return falar(p, { de: 'cliente', texto: 'Onde está meu pedido?' }, { de: 'cortae', texto: respostaOnde(p), espera: 900 });
  if (op === 'pessoa') {
    return falar(p, { de: 'cliente', texto: 'Quero falar com uma pessoa.' },
      { de: 'cortae', texto: 'Certo! Um atendente da equipe CortaÊ já está com o seu histórico e responde por aqui.', espera: 900 });
  }
  const motivo = MOTIVOS[op];
  return falar(p, { de: 'cliente', texto: motivo },
    { de: 'cortae', texto: `Sinto muito! Abrimos a reclamação e avisamos o ${a.nome}. Se for aprovado, o estorno de ${dinheiro(p.total)} volta pelo mesmo meio de pagamento.`, espera: 900, extras: { reclamacao: { motivo, em: new Date(agora()).toISOString() } } });
}

// ---------- Sobre o CortaÊ (plano de negócio) ----------
function telaSobre() {
  return {
    topo: topoMini('Sobre o CortaÊ'),
    html: `
      <img class="sobre-marca" src="img/marca.jpg" alt="CortaÊ — Escolha. Peça. Receba!">
      <div class="cartao sobre">
        <h2 class="subtitulo">O que é</h2>
        <p>Uma plataforma de delivery de carnes, no modelo do iFood: você escolhe um açougue parceiro de Santos, monta o pedido ou escolhe um kit pronto e recebe em casa. O CortaÊ não tem açougue próprio: reúne os açougues do bairro em um só app e cuida da vitrine, do pagamento, das assinaturas e do atendimento.</p>
      </div>
      <div class="passos-sobre">
        <div><b>1</b><span>Escolha</span><small>açougue, cortes ou kit</small></div>
        <div><b>2</b><span>Peça</span><small>pague com segurança</small></div>
        <div><b>3</b><span>Receba!</span><small>embalagem lacrada e gelada</small></div>
      </div>
      <div class="cartao sobre">
        <h2 class="subtitulo">Quatro frentes</h2>
        <div class="linha"><span>🥩 Açougues</span><span>Vitrine dos parceiros da cidade, com selo de verificação</span></div>
        <div class="linha"><span>📦 Kits</span><span>Kits prontos: churrasco, semana e especiais</span></div>
        <div class="linha"><span>🔄 Assinatura</span><span>Carne ou kits com a frequência que você escolher</span></div>
        <div class="linha"><span>🧺 Outros produtos</span><span>Itens que completam o pedido</span></div>
      </div>
      <div class="cartao sobre">
        <h2 class="subtitulo">Por que dá para confiar</h2>
        <ul class="checklist">
          <li>✔︎ Só entra açougue com CNPJ ativo, alvará, licença sanitária e carne de origem inspecionada (SIF, SISP ou SIM) conferidos</li>
          <li>🧊 Embalagem térmica lacrada e entrega em até ${CONFIG.ENTREGA_MAX_MIN} minutos</li>
          <li>🔒 Pagamento com checagem antifraude</li>
          <li>⭐ Nota de cada açougue visível, dada por quem comprou</li>
          <li>💬 Atendimento no app, com estorno quando algo dá errado</li>
        </ul>
      </div>
      <div class="cartao sobre">
        <h2 class="subtitulo">Missão, visão e valores</h2>
        <p><b>Missão.</b> ${esc(EMPRESA.missao)}</p>
        <p><b>Visão.</b> ${esc(EMPRESA.visao)}</p>
        <div class="chips">${EMPRESA.valores.map((v) => `<span class="chip ativo">${esc(v)}</span>`).join('')}</div>
      </div>
      <div class="cartao sobre">
        <h2 class="subtitulo">Por que "CortaÊ"</h2>
        <p>"Corta", dos cortes de carne, com "ê", expressão descontraída que passa proximidade, modernidade e brasilidade. O pin de localização no Ê representa a entrega; o vermelho e o amarelo lembram carne, churrasco e apetite.</p>
      </div>
      <a class="conheca" href="parceiro.html"><span><b>Tem um açougue?</b><small>Seja parceiro do CortaÊ</small></span>${ic('seta')}</a>
      <p class="aviso-demo">${esc(EMPRESA.razao)} · CNPJ ${esc(EMPRESA.cnpj)} · ${esc(EMPRESA.sede)}<br>Demonstração do TCC: dados fictícios.</p>`,
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
        <label class="campo">Nome<input id="c-nome" maxlength="40" value="${esc(cliente?.nome || '')}"></label>
        <label class="campo">Endereço de entrega<input id="c-end" maxlength="120" value="${esc(cliente?.endereco || '')}"></label>
        <button class="btn btn-pri" data-acao="salvar-conta">Salvar</button>
      </div>
      <div class="cartao">
        <div class="opcao"><span>Tema<small>Claro ou escuro</small></span><button class="btn btn-sec" data-tema-btn></button></div>
        <a class="opcao" href="#/pedidos"><span>Meus pedidos<small>${meusPedidos().length} pedido(s)</small></span>${ic('seta')}</a>
        <a class="opcao" href="#/assinatura"><span>Minha assinatura<small>${minhaAssinatura() ? 'Ativa' : 'Nenhuma'}</small></span>${ic('seta')}</a>
        <a class="opcao" href="#/sobre"><span>Sobre o CortaÊ<small>Como funciona, missão e valores</small></span>${ic('seta')}</a>
      </div>
      <div class="cartao">
        <div class="opcao"><span>Telas da demonstração<small>Abra em outro aparelho ou aba</small></span></div>
        <a class="opcao" href="acougue.html" target="_blank" rel="noopener"><span>🔪 Painel do açougue</span><span>↗</span></a>
        <a class="opcao" href="monitor.html" target="_blank" rel="noopener"><span>📺 Monitor da TV</span><span>↗</span></a>
        <a class="opcao" href="parceiro.html" target="_blank" rel="noopener"><span>🤝 Seja parceiro (cadastro do açougue)</span><span>↗</span></a>
        <div class="opcao"><span>Dados<small>${esc(fonte)}</small></span></div>
        <button class="opcao opcao-perigo" data-acao="zerar"><span>Zerar demonstração<small>Apaga pedidos, assinaturas, estoque e cadastros de todos</small></span>${ic('reiniciar')}</button>
      </div>
      <p class="aviso-demo">CortaÊ · demonstração do TCC · versão ${CONFIG.RELEASE}</p>`,
  };
}

const VIEWS = {
  inicio, acougues: listaAcougues, acougue: telaAcougue, categorias, categoria, busca,
  carrinho: telaCarrinho, pedido: telaPedido, pedidos: telaPedidos, assinatura: telaAssinatura, conta,
  ajuda: telaAjuda, sobre: telaSobre, churrasco: telaChurrasco,
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

// Repete um pedido: só os itens que ainda têm estoque; se o açougue recusou, troca para o mesmo corte em outro.
async function repetir(id) {
  const p = pedidos.find((x) => x.id === id);
  if (!p) return;
  const outro = p.status === 'recusado';
  const itens = {};
  let lojaNova = null;
  for (const i of p.itens) {
    let pid = i.produto_id;
    if (outro) {
      const alt = PRODUTOS.find((x) => x.nome === i.nome && x.acougue !== p.acougue_id && !esgotados.has(x.id) && (!lojaNova || x.acougue === lojaNova));
      if (!alt) continue;
      lojaNova = alt.acougue;
      pid = alt.id;
    }
    if (!esgotados.has(pid) && produto(pid)) itens[pid] = i.qtd;
  }
  if (!Object.keys(itens).length) { toast('Esses itens estão esgotados agora. Veja as sugestões no açougue.', 'erro'); return; }
  if (totalItens() > 0) {
    const ok = await confirmar({ titulo: 'Substituir o carrinho?', texto: 'O carrinho atual será trocado pelos itens deste pedido.', ok: 'Substituir' });
    if (!ok) return;
  }
  carrinho = { acougue_id: lojaNova || p.acougue_id, itens };
  salvarCarrinho();
  const faltou = p.itens.length - Object.keys(itens).length;
  toast(faltou ? `Itens no carrinho · ${faltou} esgotado(s) ficou(aram) de fora` : 'Itens no carrinho 🛒', 'ok');
  location.hash = '#/carrinho';
}

// Notificação no estilo push do celular (avisos de status, estorno e lembrete de recompra).
function notificar(titulo, texto, link) {
  const el = document.createElement(link ? 'a' : 'div');
  el.className = 'push';
  if (link) el.href = link;
  el.innerHTML = `<img src="img/icone-180.png" alt=""><div><small>CortaÊ · agora</small><b>${esc(titulo)}</b><span>${esc(texto)}</span></div>`;
  el.setAttribute('role', 'status');
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('entra'));
  el.addEventListener('click', () => el.remove());
  setTimeout(() => el.classList.remove('entra'), 4600);
  setTimeout(() => el.remove(), 5200);
  if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(180);
}

async function finalizar(botao) {
  const semEstoque = Object.keys(carrinho.itens).filter((id) => esgotados.has(id));
  if (semEstoque.length) { toast('Troque ou remova os itens esgotados antes de pedir.', 'erro'); return; }
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
  const online = escolha.pagamento !== 'dinheiro';
  // Etapa 3 do blueprint: cobrança com checagem de fraude e confirmação por e-mail (tudo encenado).
  const passos = online
    ? ['Checagem antifraude', 'Pagamento aprovado', 'Pedido enviado ao açougue', 'Confirmação enviada por e-mail']
    : ['Pedido enviado ao açougue', 'Confirmação enviada por e-mail'];
  const tela = document.createElement('div');
  tela.className = 'processando';
  tela.innerHTML = `<div class="roda"></div><h2>${online ? 'Processando pagamento…' : 'Enviando pedido…'}</h2>
    <ul class="passos-pag">${passos.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  document.body.appendChild(tela);
  const itensPag = [...tela.querySelectorAll('.passos-pag li')];
  const marcar = (i) => itensPag[i]?.classList.add('ok');
  let pedido;
  try {
    const animacao = (async () => { for (let i = 0; i < passos.length - 1; i++) { await esperar(650); marcar(i); } })();
    [pedido] = await Promise.all([api.criarPedido(dados), animacao]);
  } catch (e) {
    tela.remove();
    botao.disabled = false;
    console.error(e);
    toast('O pedido não foi enviado. Confira a internet e toque em "Fazer pedido" de novo.', 'erro');
    return;
  }
  marcar(passos.length - 1);
  tela.querySelector('.roda').outerHTML = `<div class="certo">${ic('check')}</div>`;
  tela.querySelector('h2').textContent = online ? 'Pagamento aprovado!' : 'Pedido enviado!';
  tela.querySelector('h2').insertAdjacentHTML('afterend', `<p>Pedido #${pedido.numero} · ${esc(a.nome)}</p>`);
  // Se o açougue já aceitou durante a animação, o tempo real já registrou o status novo: não volta atrás.
  if (!statusVistos.has(pedido.id)) statusVistos.set(pedido.id, pedido.status);
  enderecoDigitado = null;
  carrinho = { acougue_id: null, itens: {} };
  salvarCarrinho();
  await recarregar();
  if (!pedidos.some((p) => p.id === pedido.id)) pedidos.unshift(pedido);
  await esperar(1100);
  location.replace(`#/pedido/${pedido.id}`); // o "voltar" do pedido não cai no carrinho vazio
  tela.remove();
}

async function assinar() {
  const a = await api.criarAssinatura({
    cliente_id: cliente.id, cliente_nome: cliente.nome, endereco: cliente.endereco,
    plano_id: escolha.plano, prazo: escolha.prazo, frequencia: escolha.freq, dia_semana: escolha.dia,
    acougue_id: escolha.acougue, proxima_entrega: proximaEntrega(escolha.dia), extras: {},
  });
  escolha.renovarComo = escolha.prazo;
  await recarregar();
  if (!assinaturas.some((x) => x.id === a.id)) assinaturas.unshift(a);
  toast('Assinatura ativada! 🎉', 'ok');
  render();
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-acao]');
  if (!el) return;
  const { acao, id } = el.dataset;
  if (!pronto && ['finalizar', 'assinar', 'renovar', 'churrasco-carrinho', 'pausar','cancelar-assin', 'zerar', 'conferir', 'avaliar', 'chat-op', 'repetir'].includes(acao)) {
    toast('Carregando… toque de novo em um instante.');
    return;
  }
  switch (acao) {
    case 'repetir': return repetir(id);
    case 'tirar':
      delete carrinho.itens[id];
      if (!totalItens()) carrinho.acougue_id = null;
      salvarCarrinho();
      return render();
    case 'trocar': {
      const q = carrinho.itens[id];
      delete carrinho.itens[id];
      carrinho.itens[el.dataset.sub] = (carrinho.itens[el.dataset.sub] || 0) + q;
      salvarCarrinho();
      toast(`Trocado por ${produto(el.dataset.sub).nome}`, 'ok');
      return render();
    }
    case 'conferir':
      el.disabled = true;
      await api.atualizarExtras(id, { conferido_em: new Date(agora()).toISOString() });
      await recarregar();
      return atualizarAcompanhamento(pedidos.find((x) => x.id === id));
    case 'estrela': {
      avaliando[id] = { ...(avaliando[id] || {}), [el.dataset.campo]: Number(el.dataset.n) };
      el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.n) <= Number(el.dataset.n)));
      return;
    }
    case 'avaliar': {
      const sel = avaliando[id] || {};
      if (!sel.acougue || !sel.entrega) { toast('Toque nas estrelas do açougue e da entrega.', 'erro'); return; }
      el.disabled = true;
      const comentario = document.getElementById('aval-coment')?.value.trim() || '';
      const p = await api.atualizarExtras(id, { avaliacao: { ...sel, comentario, em: new Date(agora()).toISOString() } });
      delete avaliando[id];
      await recarregar();
      atualizarAcompanhamento(pedidos.find((x) => x.id === id) || p);
      toast('Avaliação enviada. Obrigado! ⭐', 'ok');
      // Lembrete de recompra: na vida real viria dias depois; na demo, alguns segundos.
      setTimeout(() => notificar('Hora de repor? 🥩', `Peça de novo o pedido #${p.numero} em um toque.`, '#/'), 7000);
      return;
    }
    case 'chat-op': {
      const p = pedidos.find((x) => x.id === id);
      if (!p) return;
      document.querySelectorAll('#chat-op button').forEach((b) => { b.disabled = true; });
      try { await opcaoChat(p, el.dataset.op); } finally { document.querySelectorAll('#chat-op button').forEach((b) => { b.disabled = false; }); }
      return;
    }
    case 'add': return adicionar(id);
    case 'menos': return remover(id);
    case 'voltar': if (history.length > 1) history.back(); else location.hash = '#/'; return;
    // pushState não dispara hashchange: a tela de busca é montada dentro do toque e o iPhone abre o teclado no foco.
    case 'ir-busca': history.pushState(null, '', '#/busca'); render(); return;
    case 'pagamento':
      escolha.pagamento = id;
      document.querySelectorAll('.pagamento').forEach((b) => b.classList.toggle('ativo', b.dataset.id === id));
      return;
    case 'finalizar': return finalizar(el);
    case 'plano': escolha.plano = id; return render();
    case 'prazo': escolha.prazo = id; return render();
    case 'festa': {
      const campo = el.dataset.campo;
      festa[campo] = Math.max(0, Math.min(200, festa[campo] + Number(el.dataset.d)));
      return render();
    }
    case 'festa-acougue': festa.acougue = id; return render();
    case 'churrasco-carrinho': return churrascoNoCarrinho();
    case 'renovar-como': escolha.renovarComo = id; return render();
    case 'renovar': {
      // Renovação simulada: o presente é o do prazo que terminou; o novo período pode ter outro prazo.
      const a = minhaAssinatura();
      if (!a) { await recarregar(); return render(); }
      const ganhou = prazo(a.prazo).brinde;
      const novo = prazo(escolha.renovarComo || a.prazo);
      el.disabled = true;
      try {
        await api.atualizarAssinatura(a.id, {
          prazo: novo.id,
          extras: {
            ...(a.extras || {}),
            periodo_inicio: new Date(agora()).toISOString(),
            renovacoes: (a.extras?.renovacoes || 0) + 1,
            brinde: { nome: ganhou.nome, icone: ganhou.icone, status: 'pendente', em: new Date(agora()).toISOString() },
          },
        });
      } finally { el.disabled = false; }
      await recarregar();
      notificar(`Renovada! Você ganhou ${ganhou.icone} ${ganhou.nome}`, 'O presente vai junto com a próxima entrega.', '#/assinatura');
      return render();
    }
    case 'freq': escolha.freq = id; return render();
    case 'dia': escolha.dia = Number(id); return render();
    case 'assin-acougue': escolha.acougue = id; return render();
    case 'assinar': el.disabled = true; return assinar().catch((err) => { el.disabled = false; throw err; });
    case 'pausar': {
      // A assinatura pode ter sumido (demo zerada em outro aparelho): só redesenha.
      const a = minhaAssinatura();
      if (!a) { await recarregar(); return render(); }
      el.disabled = true;
      const pausar = a.status === 'ativa';
      try {
        await api.atualizarAssinatura(a.id, pausar
          ? { status: 'pausada' }
          : { status: 'ativa', proxima_entrega: proximaEntrega(a.dia_semana) });
      } finally { el.disabled = false; }
      await recarregar();
      toast(pausar ? 'Assinatura pausada' : 'Assinatura retomada', 'ok');
      return render();
    }
    case 'cancelar-assin': {
      const ok = await confirmar({ titulo: 'Cancelar a assinatura?', texto: 'Você pode assinar de novo quando quiser.', ok: 'Cancelar assinatura', cancelar: 'Manter', perigo: true });
      if (!ok) return;
      const a = minhaAssinatura();
      if (a) await api.atualizarAssinatura(a.id, { status: 'cancelada' });
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

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('.chat-envio');
  if (!form) return;
  e.preventDefault();
  const input = form.querySelector('input');
  const texto = input.value.trim();
  const p = pedidos.find((x) => x.id === form.dataset.id);
  if (!texto || !p || !pronto) return;
  input.value = '';
  await falar(p, { de: 'cliente', texto },
    { de: 'cortae', texto: 'Recebemos sua mensagem. Um atendente da equipe CortaÊ responde por aqui em instantes.', espera: 900 });
});

// ---------- Dados ao vivo ----------
// Recargas podem se cruzar (evento do tempo real + recarga de segurança): só vale a resposta da mais nova.
// Sem isso, uma resposta velha que chega depois volta o pedido para o status anterior e repete o aviso.
let ultimaCarga = 0;
async function recarregar() {
  const minha = ++ultimaCarga;
  const dados = await Promise.all([api.listarPedidos(), api.listarAssinaturas(), api.listarEsgotados(), api.listarParceiros()]);
  if (minha !== ultimaCarga) return false;
  let lista;
  [pedidos, assinaturas, lista, parceiros] = dados;
  esgotados = new Set(lista.map((x) => x.produto_id));
  return true;
}

const TEXTO_PUSH = {
  preparando: 'O açougue aceitou e está separando seus cortes.',
  saiu: 'Embalagem térmica lacrada. O motoboy está a caminho!',
  entregue: 'Chegou! Confira o lacre e conte como foi.',
  recusado: 'O açougue não pôde atender. Toque para ver o estorno.',
};
function avisarMudancas() {
  for (const p of meusPedidos()) {
    const antes = statusVistos.get(p.id);
    if (antes && antes !== p.status) {
      const s = STATUS[p.status];
      notificar(`${s.icone} Pedido #${p.numero}: ${s.nome}`, TEXTO_PUSH[p.status] || '', `#/pedido/${p.id}`);
    }
    statusVistos.set(p.id, p.status);
    // Estorno aprovado pelo açougue depois de uma reclamação.
    const estorno = !!p.extras?.estorno;
    if (extrasVistos.has(p.id) && estorno && !extrasVistos.get(p.id)) {
      notificar('↩︎ Estorno aprovado', `${dinheiro(p.extras.estorno.valor)} do pedido #${p.numero} voltam pelo mesmo meio de pagamento.`, `#/ajuda/${p.id}`);
    }
    extrasVistos.set(p.id, estorno);
  }
}

let assinaturaDados = '';
async function aoMudar(msg) {
  if (!(await recarregar())) return; // uma recarga mais nova vai cuidar da tela
  if (msg?.tipo === 'reset') statusVistos.clear();
  // A recarga de segurança (tela que volta a aparecer, a cada 5 s) só redesenha se algo mudou de fato,
  // para não mexer na tela enquanto a pessoa escolhe um plano ou preenche um campo.
  const antesEsgotados = assinaturaDados ? JSON.parse(assinaturaDados)[2] : [];
  const agoraDados = JSON.stringify([pedidos, assinaturas, [...esgotados].sort(), parceiros]);
  const mudouEstoque = JSON.stringify(antesEsgotados) !== JSON.stringify([...esgotados].sort());
  const igual = agoraDados === assinaturaDados;
  assinaturaDados = agoraDados;
  if (msg?.tipo === 'sync' && igual) return;
  avisarMudancas();
  const r = rota();
  if (r.nome === 'pedido') {
    const p = pedidos.find((x) => x.id === r.param);
    if (p && mapa) atualizarAcompanhamento(p);
    else if (!p && msg?.tipo === 'reset') location.hash = '#/'; // demo zerada: volta para o início
    else render();
  } else if (r.nome === 'ajuda') {
    const p = pedidos.find((x) => x.id === r.param);
    if (p) atualizarChat(p);
    else if (msg?.tipo === 'reset') location.hash = '#/';
  } else if (['acougues', 'acougue', 'categoria', 'carrinho', 'churrasco'].includes(r.nome)) {
    render(); // estoque, notas e novos parceiros
  } else if (r.nome === 'busca') {
    if (mudouEstoque) document.getElementById('q')?.dispatchEvent(new Event('input'));
  } else if (r.nome === 'inicio' && mudouEstoque) {
    render();
  } else if (r.nome === 'inicio') {
    const slot = document.getElementById('slot-ativo');
    if (slot) slot.innerHTML = slotAtivo();
  } else if (r.nome === 'pedidos' || r.nome === 'assinatura') {
    render();
  } else if (r.nome === 'conta' && !document.activeElement?.matches('input')) {
    render(); // contagem de pedidos e assinatura; não redesenha no meio da digitação
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
          <h2>Bem-vindo(a)! 👋</h2>
          <label class="campo">Como você se chama?<input id="bv-nome" required maxlength="40" placeholder="Seu nome" autocomplete="given-name"></label>
          <label class="campo">Endereço de entrega<input id="bv-end" maxlength="120" value="${esc(CLIENTE_PADRAO.endereco)}"></label>
          <button class="btn btn-pri btn-bloco" type="submit">Começar</button>
        </div>
      </form>`;
    el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      cliente = {
        id: novoId(),
        nome: el.querySelector('#bv-nome').value.trim() || 'Cliente',
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
  pronto = true;
  meusPedidos().forEach((p) => statusVistos.set(p.id, p.status));
  if (!cliente) await boasVindas();
  render();
  assinaturaDados = JSON.stringify([pedidos, assinaturas, [...esgotados].sort(), parceiros]);
  meusPedidos().forEach((p) => extrasVistos.set(p.id, !!p.extras?.estorno));
  api.ouvir((msg) => aoMudar(msg).catch((e) => {
    if (msg?.tipo === 'sync') console.warn(e); // sem rede: a próxima recarga tenta de novo, sem toast
    else toast('Sem conexão com o servidor. Confira a internet.', 'erro');
  }));
  window.addEventListener('hashchange', render);
  setInterval(() => {
    const r = rota();
    if (r.nome !== 'pedido') return;
    const p = pedidos.find((x) => x.id === r.param);
    if (p?.status === 'saiu' || p?.status === 'recebido') atualizarAcompanhamento(p); // motoboy e prazo de aceite
  }, 500);
  setInterval(() => concluirEntregasVencidas(api, pedidos).catch(() => {}), 1000);
}

iniciar();
