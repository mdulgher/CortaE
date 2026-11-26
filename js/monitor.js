// Monitor da TV: mostra ao vivo o pedido que está andando, o motoboy no mapa e os números do dia.
import { db } from './db.js';
import { STATUS, ACOUGUES, acougue, plano, produto, notaAcougue, temperaturaEntrega } from './catalogo.js';
import { aceiteAtrasado, estornoDe, estrelas } from './regras.js';
import { esc, dinheiro, hora, iniciarTema, vigiarErros, toast, manterTelaAcesa } from './ui.js';
import { htmlTimeline } from './timeline.js';
import { MapaEntrega, progressoEntrega, segundosRestantes, concluirEntregasVencidas } from './entrega.js';
import { ic, pintarIcones } from './icones.js';
import { agora } from './relogio.js';

vigiarErros();
iniciarTema();
pintarIcones();
manterTelaAcesa();

const $kpis = document.getElementById('kpis');
const $dest = document.getElementById('destaque');
const $ult = document.getElementById('ultimos');
const $anuncio = document.getElementById('anuncio');

let api;
let pedidos = [];
let assinaturas = [];
let esgotados = new Set();
let parceiros = [];
const aceiteAvisado = new Set();
let mapa;
let conhecidos = null;
let assinConhecidas = null;
let filaAnuncios = [];
let anunciando = false;
let destaqueId = null;

const ATIVOS = ['recebido', 'preparando', 'saiu'];
const ultimaMudanca = (p) => (p.historico?.length ? p.historico[p.historico.length - 1].em : p.criado_em);
const recemEntregue = (p) => p.status === 'entregue' && p.entregue_em && agora() - new Date(p.entregue_em).getTime() < 8000;
// Ordem do destaque: o pedido com motoboy na rua (e o recém-entregue, por mais 8 s, junto com o anúncio)
// vem antes de tudo, para um pedido novo não tirar a entrega do mapa; depois os abertos; depois o resto.
// No mesmo grupo, ganha o que mudou por último.
const peso = (p) => (p.status === 'saiu' || recemEntregue(p) ? 2 : ATIVOS.includes(p.status) ? 1 : 0);

function destaque() {
  const lista = pedidos.slice().sort((a, b) => peso(b) - peso(a) || (ultimaMudanca(a) < ultimaMudanca(b) ? 1 : -1));
  return lista[0] || null;
}

function renderKpis() {
  const hoje = new Date(agora()).toDateString();
  const doDia = pedidos.filter((p) => new Date(p.criado_em).toDateString() === hoje);
  const valor = doDia.filter((p) => !estornoDe(p) && p.status !== 'recusado').reduce((s, p) => s + Number(p.total), 0);
  const k = (rotulo, v, cls = '', ponto = '') => `<div class="kpi cartao-tv ${cls}"><small>${ponto ? `<i class="${ponto}"></i>` : ''}${rotulo}</small><strong>${v}</strong></div>`;
  $kpis.innerHTML = [
    k('Pedidos hoje', doDia.length, 'k-dest'),
    k('Em preparo', pedidos.filter((p) => p.status === 'preparando').length, '', 'p-prep'),
    k('Nota média', `★ ${(ACOUGUES.reduce((s, a) => s + notaAcougue(a, pedidos).nota, 0) / ACOUGUES.length).toFixed(2).replace('.', ',')}`),
    k('Em entrega', pedidos.filter((p) => p.status === 'saiu').length, '', 'p-saiu'),
    k('Entregues', doDia.filter((p) => p.status === 'entregue').length, '', 'p-ok'),
    k('Vendas do dia', dinheiro(valor), 'k-valor'),
    k('Assinaturas', assinaturas.filter((a) => a.status === 'ativa').length, '', 'p-assin'),
  ].join('');
}

function htmlContagem(p) {
  if (p.status !== 'saiu') return '';
  return `<div class="contagem"><span>${ic('moto')} Motoboy a caminho</span><span>${segundosRestantes(p)}s</span></div>
    <div class="barra"><i style="width:${Math.round(progressoEntrega(p) * 100)}%"></i></div>`;
}

function htmlInfoDestaque(p) {
  const e = p.extras || {};
  const est = estornoDe(p);
  const linhas = [];
  if (p.status === 'recebido' && aceiteAtrasado(p)) linhas.push('<div class="alerta-tv">⏱️ Passou do prazo de aceite · equipe CortaÊ acionada</div>');
  if (p.status === 'saiu') linhas.push('<div class="info-tv">🧊 Embalagem térmica lacrada no açougue</div>');
  if (p.status === 'entregue') linhas.push(`<div class="info-tv">🧊 Lacre ok · ${temperaturaEntrega(p)} °C na entrega${e.conferido_em ? ' · cliente conferiu' : ''}</div>`);
  if (e.avaliacao) linhas.push(`<div class="info-tv ok">Avaliação: açougue ${estrelas(e.avaliacao.acougue)} · entrega ${estrelas(e.avaliacao.entrega)}</div>`);
  if (e.reclamacao && !est) linhas.push(`<div class="alerta-tv">💬 Reclamação: ${esc(e.reclamacao.motivo)}</div>`);
  if (est) linhas.push(`<div class="info-tv ok">↩︎ Estorno de ${dinheiro(est.valor)} · ${esc(est.motivo)}</div>`);
  return `<div class="info-lista">${linhas.join('')}</div>`;
}

function renderDestaque() {
  const p = destaque();
  destaqueId = p?.id ?? null;
  mapa.mostrar(p);
  if (!p) {
    $dest.innerHTML = `<div class="dest-vazio"><span class="grande">📱</span>Aguardando o primeiro pedido…<small>Faça um pedido pelo app no celular</small></div>`;
    return;
  }
  const a = acougue(p.acougue_id);
  $dest.innerHTML = `
    <div class="dest-cab"><h2>Pedido #${p.numero}</h2><span class="selo selo-${p.status}">${STATUS[p.status].icone} ${STATUS[p.status].curto}</span></div>
    <div class="dest-quem"><span>${esc(p.cliente_nome)} <span class="seta">pediu no</span> ${a.icone} ${esc(a.nome)}</span><small>${ic('pino', 'ic-mini')} ${esc(p.endereco)}</small></div>
    <ul class="timeline">${htmlTimeline(p)}</ul>
    ${htmlInfoDestaque(p)}
    <div class="dest-rodape">
      <div id="contagem">${htmlContagem(p)}</div>
      <div class="dest-itens">${p.itens.map((i) => `${i.qtd}× ${esc(i.nome)}`).join(' · ')}</div>
      <div class="dest-total"><span>Total</span><span>${dinheiro(p.total)}</span></div>
    </div>`;
}

function renderUltimos() {
  const ult = pedidos.slice(0, 6); // seis cartões inteiros cabem na faixa de baixo
  $ult.innerHTML = ult.length ? ult.map((p) => `
    <div class="ult cartao-tv">
      <strong>#${p.numero} · ${esc(p.cliente_nome)}</strong>
      <small>${esc(acougue(p.acougue_id)?.nome)} · ${hora(p.criado_em)} · ${dinheiro(p.total)}</small>
      <div class="marcas"><span class="selo selo-${p.status}">${STATUS[p.status].icone} ${STATUS[p.status].curto}</span>
        ${p.extras?.avaliacao ? `<span>${estrelas(p.extras.avaliacao.acougue)}</span>` : ''}
        ${p.extras?.reclamacao && !estornoDe(p) ? '<span class="selo selo-recusado">💬 Reclamação</span>' : ''}
        ${estornoDe(p) ? '<span class="selo selo-recusado">↩︎ Estornado</span>' : ''}</div>
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

// Recargas podem se cruzar (evento do tempo real + recarga de segurança): só vale a resposta da mais nova,
// e os anúncios comparam com o que já estava na tela, para nunca anunciar a mesma coisa duas vezes.
let ultimaCarga = 0;
async function recarregar() {
  const minha = ++ultimaCarga;
  const dados = await Promise.all([api.listarPedidos(), api.listarAssinaturas(), api.listarEsgotados(), api.listarParceiros()]);
  if (minha !== ultimaCarga) return false;
  const antes = new Map(pedidos.map((p) => [p.id, p.status]));
  const extrasAntes = new Map(pedidos.map((p) => [p.id, p.extras || {}]));
  const esgAntes = esgotados;
  const parcAntes = new Map(parceiros.map((c) => [c.id, c.status]));
  let lista;
  [pedidos, assinaturas, lista, parceiros] = dados;
  esgotados = new Set(lista.map((x) => x.produto_id));
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
    for (const p of pedidos) {
      const ea = extrasAntes.get(p.id);
      if (!ea) continue;
      const e = p.extras || {};
      if (e.conferido_em && !ea.conferido_em) anunciar('🧊', `Pedido #${p.numero} conferido`, `${p.cliente_nome} confirmou lacre intacto e carne gelada`);
      if (e.avaliacao && !ea.avaliacao) anunciar('⭐', `Pedido #${p.numero} avaliado`, `Açougue ${e.avaliacao.acougue}/5 · entrega ${e.avaliacao.entrega}/5${e.avaliacao.comentario ? ` · "${e.avaliacao.comentario}"` : ''}`);
      if (e.reclamacao && !ea.reclamacao) anunciar('💬', `Reclamação no pedido #${p.numero}`, `${e.reclamacao.motivo} · CortaÊ tratando com o ${acougue(p.acougue_id).nome}`);
      if (e.estorno && !ea.estorno) anunciar('↩︎', 'Estorno aprovado', `${dinheiro(e.estorno.valor)} devolvidos a ${p.cliente_nome} (pedido #${p.numero})`);
    }
    for (const id of esgotados) {
      if (!esgAntes.has(id)) { const pr = produto(id); anunciar('📦', 'Corte esgotado', `${pr?.nome} no ${acougue(pr?.acougue)?.nome}: o app já sugere substituto`); }
    }
    for (const c of parceiros) {
      const st = parcAntes.get(c.id);
      if (st === undefined) anunciar('🤝', 'Novo açougue se cadastrando', `${c.dados?.nome || 'Açougue'} começou o cadastro de parceiro`);
      else if (st !== 'ativo' && c.status === 'ativo') anunciar('✅', 'Novo parceiro ativo!', `${c.dados?.nome || 'Açougue'} passou na validação e já pode vender`);
    }
    for (const s of assinaturas) {
      if (!assinConhecidas.has(s.id)) anunciar('🔄', 'Nova assinatura!', `${s.cliente_nome} assinou o plano ${plano(s.plano_id)?.nome}`);
    }
  }
  conhecidos = new Set(pedidos.map((p) => p.id));
  assinConhecidas = new Set(assinaturas.map((s) => s.id));
  return true;
}

function relogio() {
  document.getElementById('relogio').textContent = new Date(agora()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

document.getElementById('btn-tela').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
});

async function iniciar() {
  try {
    mapa = new MapaEntrega(document.getElementById('mapa'), { todosAcougues: true });
  } catch (e) {
    // Sem o Leaflet (CDN fora do ar), a TV segue com os números e o pedido em destaque.
    console.error(e);
    mapa = { mostrar() {}, ajustar() {} };
  }
  relogio();
  setInterval(relogio, 1000);
  api = await db();
  await recarregar();
  pedidos.filter(aceiteAtrasado).forEach((p) => aceiteAvisado.add(p.id)); // atrasos antigos não viram anúncio ao abrir a TV
  render();
  api.ouvir(async (msg) => {
    if (msg?.tipo === 'reset') filaAnuncios = []; // demo zerada: avisos na fila não valem mais
    const antes = JSON.stringify([pedidos, assinaturas, [...esgotados], parceiros]);
    try {
      if (!(await recarregar())) return; // uma recarga mais nova vai desenhar
    } catch (e) {
      if (msg?.tipo === 'sync') { console.warn(e); return; } // sem rede: a próxima recarga tenta de novo, sem toast
      throw e;
    }
    if (msg?.tipo === 'sync' && antes === JSON.stringify([pedidos, assinaturas, [...esgotados], parceiros])) return; // nada mudou
    render();
  });
  setInterval(() => {
    // Prazo de aceite estourado: anuncia uma vez e redesenha o destaque com o alerta.
    for (const pe of pedidos) {
      if (pe.status === 'recebido' && aceiteAtrasado(pe) && !aceiteAvisado.has(pe.id)) {
        aceiteAvisado.add(pe.id);
        anunciar('⏱️', `Pedido #${pe.numero} sem aceite`, `O ${acougue(pe.acougue_id).nome} passou do prazo · equipe CortaÊ acionada`);
        renderDestaque();
      }
    }
    const p = destaque();
    if ((p?.id ?? null) !== destaqueId) { renderDestaque(); return; } // ex.: o entregue sai do destaque após 8 s
    if (p?.status === 'saiu') {
      mapa.mostrar(p);
      const c = document.getElementById('contagem');
      if (c) c.innerHTML = htmlContagem(p);
    }
  }, 300);
  setInterval(() => concluirEntregasVencidas(api, pedidos).catch(() => {}), 1000);
  if (api.fonte === 'local') toast('Modo local: só mostra pedidos deste navegador.', '');
}

iniciar();
