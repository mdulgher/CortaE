// Painel do açougue: recebe o pedido, prepara e despacha. Depois de "saiu", o motoboy anda sozinho.
import { db } from './db.js';
import { ACOUGUES, STATUS, acougue, plano, frequencia, DIAS_SEMANA } from './catalogo.js';
import {
  esc, dinheiro, hora, tempoDesde, iniciarTema, toast, confirmar, vigiarErros,
  liberarSom, somLiberado, tocarAviso, manterTelaAcesa,
} from './ui.js';
import { progressoEntrega, segundosRestantes, concluirEntregasVencidas } from './entrega.js';
import { ic, pintarIcones } from './icones.js';

vigiarErros();
iniciarTema();
pintarIcones();
manterTelaAcesa();

const $quadro = document.getElementById('quadro');
const $assin = document.getElementById('assinaturas');
const $filtro = document.getElementById('filtro-acougue');
const $som = document.getElementById('btn-som');

const CHAVE_FILTRO = 'cortae.painel.acougue';
let api;
let pedidos = [];
let assinaturas = [];
let aba = 'pedidos';
let conhecidos = null; // ids já vistos, para tocar o aviso só em pedido novo
const novos = new Set();

$filtro.innerHTML += ACOUGUES.map((a) => `<option value="${a.id}">${a.icone} ${esc(a.nome)}</option>`).join('');
try { $filtro.value = localStorage.getItem(CHAVE_FILTRO) || 'todos'; } catch { /* sem armazenamento */ }
$filtro.addEventListener('change', () => {
  try { localStorage.setItem(CHAVE_FILTRO, $filtro.value); } catch { /* sem armazenamento */ }
  render();
});

const doFiltro = (lista) => ($filtro.value === 'todos' ? lista : lista.filter((x) => x.acougue_id === $filtro.value));
const pagNome = { pix: 'Pix · pago', cartao: 'Cartão · pago', dinheiro: 'Dinheiro na entrega' };

function cartao(p) {
  const a = acougue(p.acougue_id);
  let acoes = '';
  if (p.status === 'recebido') {
    acoes = `<div class="acoes">
      <button class="btn btn-sec" data-acao="recusar" data-id="${p.id}">Recusar</button>
      <button class="btn btn-ok" data-acao="aceitar" data-id="${p.id}">${ic('check')} Aceitar</button></div>`;
  } else if (p.status === 'preparando') {
    acoes = `<div class="acoes"><button class="btn btn-pri" data-acao="despachar" data-id="${p.id}">${ic('moto')} Saiu para entrega</button></div>`;
  } else if (p.status === 'saiu') {
    acoes = `<div class="chega"><span>${ic('moto', 'ic-mini')} A caminho</span><span data-seg="${p.id}">${segundosRestantes(p)}s</span></div>
      <div class="barra"><i data-barra="${p.id}" style="width:${Math.round(progressoEntrega(p) * 100)}%"></i></div>`;
  } else if (p.status === 'entregue') {
    acoes = `<div class="chega ok"><span>${ic('check', 'ic-mini')} Entregue</span><span>${hora(p.entregue_em)}</span></div>`;
  } else if (p.status === 'recusado') {
    acoes = '<div class="chega nao"><span>Recusado</span></div>';
  }
  return `
    <article class="ped ${novos.has(p.id) ? 'novo' : ''}">
      <div class="ped-cab"><strong>#${p.numero}</strong><small>${hora(p.criado_em)} · <span data-tempo="${esc(p.criado_em)}">${tempoDesde(p.criado_em)}</span></small></div>
      ${$filtro.value === 'todos' ? `<span class="loja-tag">${a.icone} ${esc(a.nome)}</span>` : ''}
      <div class="cli">${esc(p.cliente_nome)}<small>${ic('pino', 'ic-mini')} ${esc(p.endereco)}</small></div>
      <ul>${p.itens.map((i) => `<li>${i.qtd}× ${esc(i.nome)}</li>`).join('')}</ul>
      <div class="tot"><span>${dinheiro(p.total)}</span><small>${pagNome[p.pagamento] || ''}</small></div>
      ${acoes}
    </article>`;
}

function render() {
  const lista = doFiltro(pedidos);
  const colunas = [
    { id: 'recebido', nome: 'Novos', itens: lista.filter((p) => p.status === 'recebido') },
    { id: 'preparando', nome: 'Em preparo', itens: lista.filter((p) => p.status === 'preparando') },
    { id: 'saiu', nome: 'Em entrega', itens: lista.filter((p) => p.status === 'saiu') },
    { id: 'entregue', nome: 'Concluídos', itens: lista.filter((p) => p.status === 'entregue' || p.status === 'recusado').slice(0, 8) },
  ];
  $quadro.innerHTML = colunas.map((c) => `
    <section class="coluna" data-col="${c.id}">
      <h2><span class="col-nome"><i></i>${c.nome}</span><span class="selo">${c.itens.length}</span></h2>
      ${c.itens.length ? c.itens.map(cartao).join('') : '<div class="vazio-col">Nada por aqui</div>'}
    </section>`).join('');
  const nNovos = lista.filter((p) => p.status === 'recebido').length;
  document.getElementById('cont-novos').textContent = nNovos || '';
  document.title = nNovos ? `(${nNovos}) CortaÊ Parceiros` : 'CortaÊ Parceiros';

  const ativas = doFiltro(assinaturas).filter((a) => a.status !== 'cancelada');
  document.getElementById('cont-assin').textContent = ativas.length || '';
  $assin.innerHTML = ativas.length ? `
    <table class="tabela">
      <thead><tr><th>Cliente</th><th>Plano</th><th>Frequência</th><th>Próxima entrega</th><th>Açougue</th><th>Status</th></tr></thead>
      <tbody>${ativas.map((s) => `
        <tr>
          <td>${esc(s.cliente_nome)}<br><small>${esc(s.endereco)}</small></td>
          <td>${plano(s.plano_id)?.icone} ${esc(plano(s.plano_id)?.nome)} · ${dinheiro(plano(s.plano_id)?.preco)}</td>
          <td>${esc(frequencia(s.frequencia)?.nome)} · ${DIAS_SEMANA[s.dia_semana]}</td>
          <td>${s.status === 'pausada' ? '—' : (s.proxima_entrega || '').split('-').reverse().join('/')}</td>
          <td>${esc(acougue(s.acougue_id)?.nome)}</td>
          <td><span class="selo ${s.status === 'ativa' ? 'selo-entregue' : 'selo-recebido'}">${s.status === 'ativa' ? 'Ativa' : 'Pausada'}</span></td>
        </tr>`).join('')}</tbody>
    </table>` : '<div class="coluna"><div class="vazio-col">Nenhuma assinatura ativa ainda</div></div>';
}

function atualizarEntregas() {
  for (const p of pedidos) {
    if (p.status !== 'saiu') continue;
    const seg = document.querySelector(`[data-seg="${p.id}"]`);
    const barra = document.querySelector(`[data-barra="${p.id}"]`);
    if (seg) seg.textContent = `${segundosRestantes(p)}s`;
    if (barra) barra.style.width = `${Math.round(progressoEntrega(p) * 100)}%`;
  }
}

// Recargas podem se cruzar (clique, eco do tempo real, recarga de segurança): só vale a resposta da mais nova.
let ultimaCarga = 0;
async function recarregar() {
  const minha = ++ultimaCarga;
  const dados = await Promise.all([api.listarPedidos(), api.listarAssinaturas()]);
  if (minha !== ultimaCarga) return false;
  [pedidos, assinaturas] = dados;
  const ids = new Set(pedidos.map((p) => p.id));
  if (conhecidos) {
    const chegaram = doFiltro(pedidos).filter((p) => !conhecidos.has(p.id) && p.status === 'recebido');
    chegaram.forEach((p) => {
      novos.add(p.id);
      setTimeout(() => novos.delete(p.id), 8000);
      toast(`🔔 Novo pedido #${p.numero} · ${p.cliente_nome} · ${dinheiro(p.total)}`, 'ok');
    });
    if (chegaram.length) tocarAviso();
  }
  conhecidos = ids;
  return true;
}

document.addEventListener('click', async (e) => {
  const aba1 = e.target.closest('[data-aba]');
  if (aba1) {
    aba = aba1.dataset.aba;
    document.querySelectorAll('.aba-p').forEach((b) => b.classList.toggle('ativa', b === aba1));
    $quadro.classList.toggle('oculto', aba !== 'pedidos');
    $assin.classList.toggle('oculto', aba !== 'assinaturas');
    return;
  }
  const el = e.target.closest('[data-acao]');
  if (!el) return;
  const { acao, id } = el.dataset;
  el.disabled = true;
  try {
    if (acao === 'aceitar') await api.mudarStatus(id, 'preparando', 'recebido');
    if (acao === 'despachar') await api.mudarStatus(id, 'saiu', 'preparando');
    if (acao === 'recusar') {
      const ok = await confirmar({ titulo: 'Recusar este pedido?', texto: 'O cliente será avisado e nada será cobrado.', ok: 'Recusar', perigo: true });
      if (!ok) { el.disabled = false; return; }
      await api.mudarStatus(id, 'recusado', 'recebido');
    }
    // Não espera o eco do tempo real: o cartão muda de coluna na hora do clique.
    await recarregar();
    render();
  } catch (err) {
    el.disabled = false;
    throw err;
  }
});

// O navegador só toca som depois de um clique. O botão confirma com o acorde; qualquer outro clique no
// painel também libera o som, para o aviso de pedido novo não falhar se ninguém lembrar do botão.
async function ligarSom(tocar) {
  await liberarSom();
  $som.classList.toggle('ligado', somLiberado());
  $som.innerHTML = `${ic('sino')} ${somLiberado() ? 'Som ligado' : 'Ativar som'}`;
  if (tocar) tocarAviso();
}
$som.addEventListener('click', () => ligarSom(true));
document.addEventListener('pointerdown', () => { if (!somLiberado()) ligarSom(false); });

document.getElementById('btn-zerar').addEventListener('click', async () => {
  const ok = await confirmar({ titulo: 'Zerar a demonstração?', texto: 'Apaga todos os pedidos e assinaturas, em todos os aparelhos.', ok: 'Zerar tudo', perigo: true });
  if (!ok) return;
  await api.zerar();
  toast('Demonstração zerada', 'ok');
});

async function iniciar() {
  api = await db();
  await recarregar();
  render();
  api.ouvir(async (msg) => {
    const antes = JSON.stringify([pedidos, assinaturas]);
    try {
      if (!(await recarregar())) return; // uma recarga mais nova vai desenhar
    } catch (e) {
      if (msg?.tipo === 'sync') { console.warn(e); return; } // sem rede: a próxima recarga tenta de novo, sem toast
      throw e;
    }
    if (msg?.tipo === 'sync' && antes === JSON.stringify([pedidos, assinaturas])) return; // nada mudou
    render();
  });
  setInterval(atualizarEntregas, 500);
  setInterval(() => concluirEntregasVencidas(api, pedidos).catch(() => {}), 1000);
  // "há N s" / "há N min": troca só o texto, sem redesenhar os cartões (redesenhar engolia cliques).
  setInterval(() => document.querySelectorAll('[data-tempo]').forEach((el) => { el.textContent = tempoDesde(el.dataset.tempo); }), 1000);
  if (api.fonte === 'local') toast('Modo local: abra o app do cliente neste mesmo navegador.', '');
}

iniciar();
