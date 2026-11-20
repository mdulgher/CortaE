// Monitor da TV: mostra ao vivo o pedido que está andando, o motoboy no mapa e os números do dia.
import { db } from './db.js';
import { STATUS, acougue, plano } from './catalogo.js';
import { esc, dinheiro, hora, iniciarTema, vigiarErros, toast } from './ui.js';
import { htmlTimeline } from './timeline.js';
import { MapaEntrega, progressoEntrega, segundosRestantes, concluirEntregasVencidas } from './entrega.js';

vigiarErros();
iniciarTema();

const $kpis = document.getElementById('kpis');
const $dest = document.getElementById('destaque');
const $ult = document.getElementById('ultimos');
const $anuncio = document.getElementById('anuncio');

let api;
let pedidos = [];
let assinaturas = [];
let mapa;
let conhecidos = null;
let assinConhecidas = null;
let filaAnuncios = [];
let anunciando = false;

const ATIVOS = ['recebido', 'preparando', 'saiu'];
const ultimaMudanca = (p) => (p.historico?.length ? p.historico[p.historico.length - 1].em : p.criado_em);

function destaque() {
  const ativos = pedidos.filter((p) => ATIVOS.includes(p.status));
  const lista = (ativos.length ? ativos : pedidos).slice().sort((a, b) => (ultimaMudanca(a) < ultimaMudanca(b) ? 1 : -1));
  return lista[0] || null;
}

function renderKpis() {
  const hoje = new Date().toDateString();
  const doDia = pedidos.filter((p) => new Date(p.criado_em).toDateString() === hoje);
  const valor = doDia.filter((p) => p.status !== 'recusado').reduce((s, p) => s + Number(p.total), 0);
  const k = (rotulo, v, cls = '') => `<div class="kpi ${cls}"><small>${rotulo}</small><strong>${v}</strong></div>`;
  $kpis.innerHTML = [
    k('Pedidos hoje', doDia.length, 'k-dest'),
    k('🔪 Em preparo', pedidos.filter((p) => p.status === 'preparando').length),
    k('🛵 Em entrega', pedidos.filter((p) => p.status === 'saiu').length),
    k('✅ Entregues', doDia.filter((p) => p.status === 'entregue').length),
    k('Vendas do dia', dinheiro(valor)),
    k('🔄 Assinaturas', assinaturas.filter((a) => a.status === 'ativa').length),
  ].join('');
}

function htmlContagem(p) {
  if (p.status !== 'saiu') return '';
  return `<div class="contagem"><span>🛵 Motoboy a caminho</span><span>${segundosRestantes(p)}s</span></div>
    <div class="barra"><i style="width:${Math.round(progressoEntrega(p) * 100)}%"></i></div>`;
}

function renderDestaque() {
  const p = destaque();
  mapa.mostrar(p);
  if (!p) {
    $dest.innerHTML = `<div class="dest-vazio"><span class="grande">📱</span>Aguardando o primeiro pedido…<small>Faça um pedido pelo app no celular</small></div>`;
    return;
  }
  const a = acougue(p.acougue_id);
  $dest.innerHTML = `
    <div class="dest-cab"><h2>Pedido #${p.numero}</h2><span class="selo selo-${p.status}">${STATUS[p.status].icone} ${STATUS[p.status].curto}</span></div>
    <div class="dest-quem">👤 ${esc(p.cliente_nome)} → ${a.icone} ${esc(a.nome)}<small>📍 ${esc(p.endereco)}</small></div>
    <ul class="timeline">${htmlTimeline(p)}</ul>
    <div class="dest-rodape">
      <div id="contagem">${htmlContagem(p)}</div>
      <div class="dest-itens">${p.itens.map((i) => `${i.qtd}× ${esc(i.nome)}`).join(' · ')}</div>
      <div class="dest-total"><span>Total</span><span>${dinheiro(p.total)}</span></div>
    </div>`;
}

function renderUltimos() {
  const ult = pedidos.slice(0, 8);
  $ult.innerHTML = ult.length ? ult.map((p) => `
    <div class="ult">
      <strong>#${p.numero} · ${esc(p.cliente_nome)}</strong>
      <small>${esc(acougue(p.acougue_id)?.nome)} · ${hora(p.criado_em)} · ${dinheiro(p.total)}</small>
      <span class="selo selo-${p.status}" style="justify-self:start">${STATUS[p.status].icone} ${STATUS[p.status].curto}</span>
    </div>`).join('') : '<div class="ult-vazio">Os pedidos do dia aparecem aqui.</div>';
}

function render() {
  renderKpis();
  renderDestaque();
  renderUltimos();
}

function anunciar(ico, titulo, texto) {
  filaAnuncios.push({ ico, titulo, texto });
  if (!anunciando) proximoAnuncio();
}
function proximoAnuncio() {
  const a = filaAnuncios.shift();
  if (!a) { anunciando = false; $anuncio.classList.add('oculto'); return; }
  anunciando = true;
  $anuncio.innerHTML = `<span class="ico">${a.ico}</span><div><h2>${esc(a.titulo)}</h2><p>${esc(a.texto)}</p></div>`;
  $anuncio.classList.remove('oculto');
  $anuncio.style.animation = 'none';
  void $anuncio.offsetWidth;
  $anuncio.style.animation = '';
  setTimeout(proximoAnuncio, 4500);
}

async function recarregar() {
  const antes = new Map(pedidos.map((p) => [p.id, p.status]));
  [pedidos, assinaturas] = await Promise.all([api.listarPedidos(), api.listarAssinaturas()]);
  if (conhecidos) {
    for (const p of pedidos) {
      const a = acougue(p.acougue_id);
      if (!conhecidos.has(p.id)) {
        anunciar('🔔', `Novo pedido #${p.numero}`, `${p.cliente_nome} pediu no ${a.nome} · ${dinheiro(p.total)}`);
      } else if (antes.get(p.id) !== p.status && p.status === 'saiu') {
        anunciar('🛵', `Pedido #${p.numero} saiu para entrega`, `${a.nome} → ${p.cliente_nome}`);
      } else if (antes.get(p.id) !== p.status && p.status === 'entregue') {
        anunciar('✅', `Pedido #${p.numero} entregue!`, `${p.cliente_nome} recebeu às ${hora(p.entregue_em)}`);
      }
    }
    for (const s of assinaturas) {
      if (!assinConhecidas.has(s.id)) anunciar('🔄', 'Nova assinatura!', `${s.cliente_nome} assinou o plano ${plano(s.plano_id)?.nome}`);
    }
  }
  conhecidos = new Set(pedidos.map((p) => p.id));
  assinConhecidas = new Set(assinaturas.map((s) => s.id));
}

function relogio() {
  document.getElementById('relogio').textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

document.getElementById('btn-tela').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
});

async function iniciar() {
  mapa = new MapaEntrega(document.getElementById('mapa'), { todosAcougues: true });
  relogio();
  setInterval(relogio, 1000);
  api = await db();
  await recarregar();
  render();
  api.ouvir(async () => { await recarregar(); render(); });
  setInterval(() => {
    const p = destaque();
    if (p?.status === 'saiu') {
      mapa.mostrar(p);
      const c = document.getElementById('contagem');
      if (c) c.innerHTML = htmlContagem(p);
    }
  }, 300);
  setInterval(() => concluirEntregasVencidas(api, pedidos).catch(() => {}), 1000);
  window.addEventListener('resize', () => mapa.ajustar());
  if (api.fonte === 'local') toast('Modo local: só mostra pedidos deste navegador.', '');
}

iniciar();
