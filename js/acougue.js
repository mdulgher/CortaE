// Painel do açougue: recebe o pedido, prepara e despacha. Depois de "saiu", o motoboy anda sozinho.
// Também: prazo de aceite, reclamações com estorno, estoque, repasse e documentos (blueprints da Karla).
import { db } from './db.js';
import {
  ACOUGUES, STATUS, CATEGORIAS, PRODUTOS, REQUISITOS, TEMPERATURAS, EMPRESA,
  acougue, plano, frequencia, planoParceiro, notaAcougue, DIAS_SEMANA, prazo, precoAssinatura,
} from './catalogo.js';
import {
  esc, dinheiro, hora, tempoDesde, iniciarTema, toast, confirmar, vigiarErros,
  liberarSom, somLiberado, tocarAviso, manterTelaAcesa,
} from './ui.js';
import { progressoEntrega, segundosRestantes, concluirEntregasVencidas } from './entrega.js';
import {
  segundosParaAceite, aceiteAtrasado, mmss, estornoDe, htmlAvaliacao, dataDaqui,
} from './regras.js';
import { ic, pintarIcones } from './icones.js';
import { agora } from './relogio.js';

vigiarErros();
iniciarTema();
pintarIcones();
manterTelaAcesa();

const $quadro = document.getElementById('quadro');
const $assin = document.getElementById('assinaturas');
const $estoque = document.getElementById('estoque');
const $repasse = document.getElementById('repasse');
const $docs = document.getElementById('documentos');
const $alertas = document.getElementById('alertas');
const $filtro = document.getElementById('filtro-acougue');
const $som = document.getElementById('btn-som');

const CHAVE_FILTRO = 'cortae.painel.acougue';
const CHAVE_RENOVADOS = 'cortae.painel.renovados'; // documentos renovados neste painel (só encenação)
let api;
let pedidos = [];
let assinaturas = [];
let esgotados = new Set();
let aba = 'pedidos';
let conhecidos = null; // ids já vistos, para tocar o aviso só em pedido novo
let extrasConhecidos = null; // reclamações e avaliações já vistas
const novos = new Set();
let renovados = new Set();
try { renovados = new Set(JSON.parse(localStorage.getItem(CHAVE_RENOVADOS) || '[]')); } catch { /* sem armazenamento */ }

$filtro.innerHTML += ACOUGUES.map((a) => `<option value="${a.id}">${a.icone} ${esc(a.nome)}</option>`).join('');
try { $filtro.value = localStorage.getItem(CHAVE_FILTRO) || 'todos'; } catch { /* sem armazenamento */ }
$filtro.addEventListener('change', () => {
  try { localStorage.setItem(CHAVE_FILTRO, $filtro.value); } catch { /* sem armazenamento */ }
  render();
});

const doFiltro = (lista) => ($filtro.value === 'todos' ? lista : lista.filter((x) => x.acougue_id === $filtro.value));
const lojasDoFiltro = () => ($filtro.value === 'todos' ? ACOUGUES : [acougue($filtro.value)]);
const pagNome = { pix: 'Pix · pago', cartao: 'Cartão · pago', dinheiro: 'Dinheiro na entrega' };
const reclamacaoAberta = (p) => p.extras?.reclamacao && !p.extras?.estorno;

// ---------- Pedidos ----------
function htmlAceite(p) {
  const s = segundosParaAceite(p);
  if (s > 0) return `<div class="prazo" data-aceite="${p.id}">${ic('relogio', 'ic-mini')} Aceitar em <b>${mmss(s)}</b></div>`;
  return `<div class="prazo atrasado" data-aceite="${p.id}">⚠ Prazo de aceite estourado · equipe CortaÊ avisada</div>`;
}

function htmlExtras(p) {
  const e = p.extras || {};
  const est = estornoDe(p);
  let h = '';
  if (e.conferido_em) h += `<div class="extra ok">${ic('check', 'ic-mini')} Cliente conferiu lacre e itens</div>`;
  if (e.avaliacao) h += `<div class="extra">${htmlAvaliacao(e.avaliacao)}</div>`;
  if (e.reclamacao) {
    h += `<div class="extra reclamacao"><b>⚠ Reclamação:</b> ${esc(e.reclamacao.motivo)}
      ${est ? '' : `<button class="btn btn-perigo" data-acao="estornar" data-id="${p.id}">Aprovar estorno de ${dinheiro(p.total)}</button>`}</div>`;
  }
  if (est) h += `<div class="extra estorno">↩︎ Estornado ${dinheiro(est.valor)} · ${esc(est.motivo)}</div>`;
  return h;
}

function cartao(p) {
  const a = acougue(p.acougue_id);
  let acoes = '';
  if (p.status === 'recebido') {
    acoes = `${htmlAceite(p)}<div class="acoes">
      <button class="btn btn-sec" data-acao="recusar" data-id="${p.id}">Recusar</button>
      <button class="btn btn-ok" data-acao="aceitar" data-id="${p.id}">${ic('check')} Aceitar</button></div>`;
  } else if (p.status === 'preparando') {
    acoes = `<div class="extra">🧊 Embalar em caixa térmica e lacrar antes de despachar</div>
      <div class="acoes"><button class="btn btn-pri" data-acao="despachar" data-id="${p.id}">${ic('moto')} Lacrado · saiu para entrega</button></div>`;
  } else if (p.status === 'saiu') {
    acoes = `<div class="chega"><span>${ic('moto', 'ic-mini')} A caminho</span><span data-seg="${p.id}">${segundosRestantes(p)}s</span></div>
      <div class="barra"><i data-barra="${p.id}" style="width:${Math.round(progressoEntrega(p) * 100)}%"></i></div>`;
  } else if (p.status === 'entregue') {
    acoes = `<div class="chega ok"><span>${ic('check', 'ic-mini')} Entregue</span><span>${hora(p.entregue_em)}</span></div>`;
  } else if (p.status === 'recusado') {
    acoes = '<div class="chega nao"><span>Recusado</span></div>';
  }
  const classe = [novos.has(p.id) ? 'novo' : '', p.status === 'recebido' && aceiteAtrasado(p) ? 'atrasado' : '', reclamacaoAberta(p) ? 'com-reclamacao' : ''].join(' ');
  return `
    <article class="ped ${classe}">
      <div class="ped-cab"><strong>#${p.numero}</strong><small>${hora(p.criado_em)} · <span data-tempo="${esc(p.criado_em)}">${tempoDesde(p.criado_em)}</span></small></div>
      ${$filtro.value === 'todos' ? `<span class="loja-tag">${a.icone} ${esc(a.nome)}</span>` : ''}
      <div class="cli">${esc(p.cliente_nome)}<small>${ic('pino', 'ic-mini')} ${esc(p.endereco)}</small></div>
      <ul>${p.itens.map((i) => `<li>${i.qtd}× ${esc(i.nome)}</li>`).join('')}</ul>
      <div class="tot"><span>${dinheiro(p.total)}</span><small>${pagNome[p.pagamento] || ''}</small></div>
      ${acoes}
      ${htmlExtras(p)}
    </article>`;
}

function renderPedidos() {
  const lista = doFiltro(pedidos);
  const concluidos = lista.filter((p) => p.status === 'entregue' || p.status === 'recusado')
    .sort((x, y) => Number(!!reclamacaoAberta(y)) - Number(!!reclamacaoAberta(x))) // reclamação aberta primeiro
    .slice(0, 8);
  const colunas = [
    { id: 'recebido', nome: 'Novos', itens: lista.filter((p) => p.status === 'recebido') },
    { id: 'preparando', nome: 'Em preparo', itens: lista.filter((p) => p.status === 'preparando') },
    { id: 'saiu', nome: 'Em entrega', itens: lista.filter((p) => p.status === 'saiu') },
    { id: 'entregue', nome: 'Concluídos', itens: concluidos },
  ];
  $quadro.innerHTML = colunas.map((c) => `
    <section class="coluna" data-col="${c.id}">
      <h2><span class="col-nome"><i></i>${c.nome}</span><span class="selo">${c.itens.length}</span></h2>
      ${c.itens.length ? c.itens.map(cartao).join('') : '<div class="vazio-col">Nada por aqui</div>'}
    </section>`).join('');
  const nNovos = lista.filter((p) => p.status === 'recebido').length;
  document.getElementById('cont-novos').textContent = nNovos || '';
  document.title = nNovos ? `(${nNovos}) CortaÊ Parceiros` : 'CortaÊ Parceiros';
}

function renderAssinaturas() {
  const ativas = doFiltro(assinaturas).filter((a) => a.status !== 'cancelada');
  document.getElementById('cont-assin').textContent = ativas.length || '';
  $assin.innerHTML = ativas.length ? `
    <table class="tabela">
      <thead><tr><th>Cliente</th><th>Plano</th><th>Prazo</th><th>Frequência</th><th>Próxima entrega</th><th>Açougue</th><th>Status</th></tr></thead>
      <tbody>${ativas.map((s) => {
        const pz = prazo(s.prazo);
        const b = s.extras?.brinde;
        return `
        <tr>
          <td>${esc(s.cliente_nome)}<br><small>${esc(s.endereco)}</small></td>
          <td>${plano(s.plano_id)?.icone} ${esc(plano(s.plano_id)?.nome)} · ${dinheiro(precoAssinatura(s.plano_id, s.prazo))}</td>
          <td>${esc(pz.nome)}${pz.desconto ? ` <small>(−${Math.round(pz.desconto * 100)}%)</small>` : ''}${s.extras?.renovacoes ? `<br><small>${s.extras.renovacoes}ª renovação</small>` : ''}</td>
          <td>${esc(frequencia(s.frequencia)?.nome)} · ${DIAS_SEMANA[s.dia_semana]}</td>
          <td>${s.status === 'pausada' ? '—' : (s.proxima_entrega || '').split('-').reverse().join('/')}
            ${b?.status === 'pendente' ? `<br><span class="brinde selo selo-preparando">🎁 Levar ${esc(b.nome)}</span>
              <br><button class="btn btn-ama" data-acao="brinde-entregue" data-id="${s.id}" style="margin-top:6px;padding:6px 10px;font-size:.82rem">Presente entregue</button>` : ''}
            ${b?.status === 'entregue' ? `<br><small>🎁 ${esc(b.nome)} entregue ✓</small>` : ''}</td>
          <td>${esc(acougue(s.acougue_id)?.nome)}</td>
          <td><span class="selo ${s.status === 'ativa' ? 'selo-entregue' : 'selo-recebido'}">${s.status === 'ativa' ? 'Ativa' : 'Pausada'}</span></td>
        </tr>`;
      }).join('')}</tbody>
    </table>` : '<div class="coluna"><div class="vazio-col">Nenhuma assinatura ativa ainda</div></div>';
}

// ---------- Estoque: o açougue marca o corte esgotado e o app para de vender ----------
function renderEstoque() {
  const nEsg = PRODUTOS.filter((p) => esgotados.has(p.id) && lojasDoFiltro().some((a) => a.id === p.acougue)).length;
  document.getElementById('cont-esg').textContent = nEsg || '';
  $estoque.innerHTML = `
    <p class="dica-painel">Marque o que acabou: o app mostra "esgotado" na hora e sugere um substituto ao cliente.</p>
    ${lojasDoFiltro().map((a) => `
      <div class="bloco-loja">
        <h2>${a.icone} ${esc(a.nome)}</h2>
        <div class="grade-estoque">${CATEGORIAS.map((c) => PRODUTOS.filter((p) => p.acougue === a.id && p.cat === c.id).map((p) => {
    const esg = esgotados.has(p.id);
    return `<div class="item-estoque ${esg ? 'esg' : ''}">
            <span>${p.icone} <b>${esc(p.nome)}</b><small>${esc(p.peso)} · ${dinheiro(p.preco)}</small></span>
            <button class="btn ${esg ? 'btn-perigo' : 'btn-sec'}" data-acao="esgotar" data-id="${p.id}" data-loja="${a.id}" aria-pressed="${esg}">${esg ? 'Esgotado' : 'Disponível'}</button>
          </div>`;
  }).join('')).join('')}</div>
      </div>`).join('')}`;
}

// ---------- Repasse e conciliação (comissão do plano do parceiro) ----------
function contas(p) {
  const pl = planoParceiro(acougue(p.acougue_id).plano);
  const est = estornoDe(p);
  const online = p.pagamento !== 'dinheiro';
  const comissao = Number(p.subtotal) * pl.comissao;
  const taxaPag = online ? Number(p.total) * pl.pagOnline : 0;
  const repasse = est ? 0 : Number(p.subtotal) - comissao - taxaPag;
  return { pl, est, comissao: est ? 0 : comissao, taxaPag: est ? 0 : taxaPag, repasse, entrega: est ? 0 : Number(p.taxa) };
}

function renderRepasse() {
  const lista = doFiltro(pedidos).filter((p) => p.status === 'entregue' || estornoDe(p));
  const linhas = lista.map((p) => ({ p, c: contas(p) }));
  const soma = (f) => linhas.reduce((s, l) => s + f(l), 0);
  const entrou = soma((l) => (l.p.status === 'recusado' && l.p.pagamento === 'dinheiro' ? 0 : Number(l.p.total)));
  const estornos = soma((l) => Number(l.c.est?.valor || 0));
  const comissao = soma((l) => l.c.comissao);
  const taxas = soma((l) => l.c.taxaPag);
  const repasse = soma((l) => l.c.repasse);
  const entregas = soma((l) => l.c.entrega);
  const fecha = Math.abs(entrou - (repasse + comissao + taxas + entregas + estornos)) < 0.01;
  const planos = [...new Set(lojasDoFiltro().map((a) => a.plano))].map(planoParceiro);
  $repasse.innerHTML = `
    <div class="resumo-repasse">
      <div class="cartao-p"><small>Vendas (pago pelos clientes)</small><strong>${dinheiro(entrou)}</strong></div>
      <div class="cartao-p"><small>Comissão CortaÊ</small><strong>${dinheiro(comissao)}</strong></div>
      <div class="cartao-p"><small>Taxa de pagamento online</small><strong>${dinheiro(taxas)}</strong></div>
      <div class="cartao-p"><small>Estornos</small><strong>${dinheiro(estornos)}</strong></div>
      <div class="cartao-p destaque"><small>Repasse ao açougue</small><strong>${dinheiro(repasse)}</strong></div>
    </div>
    <p class="dica-painel">${planos.map((pl) => `Plano <b>${pl.nome}</b>: ${Math.round(pl.comissao * 100)}% de comissão sobre os produtos + ${String(pl.pagOnline * 100).replace('.', ',')}% no pagamento online · ${pl.entrega} · mensalidade de ${dinheiro(pl.mensalidade)} acima de R$ 1.800/mês em vendas`).join('<br>')}.
      <br>Valores de referência (planos do iFood citados no plano de negócio), a definir pelo grupo. A taxa de entrega fica com o CortaÊ, que faz a entrega.</p>
    <div class="conciliacao ${fecha ? 'ok' : ''}">${fecha ? ic('check', 'ic-mini') : '⚠'} Conciliação: entrou ${dinheiro(entrou)} = repasse ${dinheiro(repasse)} + comissão ${dinheiro(comissao)} + taxas ${dinheiro(taxas)} + entregas ${dinheiro(entregas)} + estornos ${dinheiro(estornos)}</div>
    ${linhas.length ? `<table class="tabela">
      <thead><tr><th>Pedido</th><th>Pago</th><th>Produtos</th><th>Comissão</th><th>Taxa pag.</th><th>Repasse</th></tr></thead>
      <tbody>${linhas.map(({ p, c }) => `<tr>
        <td>#${p.numero} · ${esc(p.cliente_nome)}<br><small>${esc(acougue(p.acougue_id).nome)} · ${hora(p.criado_em)}</small></td>
        <td>${dinheiro(p.total)}<br><small>${pagNome[p.pagamento] || ''}</small></td>
        <td>${dinheiro(p.subtotal)}</td>
        <td>${dinheiro(c.comissao)} <small>${Math.round(c.pl.comissao * 100)}%</small></td>
        <td>${dinheiro(c.taxaPag)}</td>
        <td>${c.est ? `<span class="selo selo-recusado">↩︎ Estornado</span>` : `<b>${dinheiro(c.repasse)}</b>`}</td>
      </tr>`).join('')}</tbody></table>` : '<div class="coluna"><div class="vazio-col">Os pedidos entregues aparecem aqui com o repasse de cada um</div></div>'}`;
}

// ---------- Documentos e regularidade (item 4.2) ----------
const ALERTA_DIAS = 30;
function documentos(a) {
  const dias = (id) => (renovados.has(`${a.id}:${id}`) ? a.docs[id] + 365 : a.docs[id]);
  return REQUISITOS.map((r) => {
    const base = { ...r, numero: '', validade: null };
    if (r.id === 'cnpj') return { ...base, numero: a.cnpj, situacao: 'Ativo na Receita Federal' };
    if (r.id === 'banco') return { ...base, numero: 'Conta PJ no CNPJ · banco fictício', situacao: 'Cadastrada para repasse' };
    const numero = { alvara: `Alvará ${a.cnpj.slice(0, 6)}/2026`, licenca: a.licenca, origem: a.inspecao, boaspraticas: 'Manual de boas práticas e planilha de temperatura' }[r.id];
    return { ...base, numero, validade: dias(r.id) };
  });
}
const docsVencendo = () => ACOUGUES.flatMap((a) => documentos(a).filter((d) => d.validade !== null && d.validade <= ALERTA_DIAS).map((d) => ({ a, d })));

function renderDocumentos() {
  const venc = docsVencendo().filter(({ a }) => lojasDoFiltro().includes(a));
  document.getElementById('cont-docs').textContent = venc.length || '';
  $docs.innerHTML = `
    <p class="dica-painel">O CortaÊ confere estes documentos no cadastro e acompanha os vencimentos. O painel avisa ${ALERTA_DIAS} dias antes, para o açougue não ser suspenso.</p>
    ${lojasDoFiltro().map((a) => `
      <div class="bloco-loja">
        <h2>${a.icone} ${esc(a.nome)} <small>${esc(a.razao)} · CNPJ ${esc(a.cnpj)} · nota ${notaAcougue(a, pedidos).nota.toFixed(1).replace('.', ',')}</small></h2>
        <table class="tabela">
          <thead><tr><th>Requisito</th><th>Documento</th><th>Quem emite ou fiscaliza</th><th>Situação</th></tr></thead>
          <tbody>${documentos(a).map((d) => {
    let sit = `<span class="selo selo-entregue">${esc(d.situacao || '')}</span>`;
    if (d.validade !== null) {
      sit = d.validade <= ALERTA_DIAS
        ? `<span class="selo selo-recusado">⚠ Vence em ${d.validade} dias (${dataDaqui(d.validade)})</span>
           <button class="btn btn-ama" data-acao="renovar" data-id="${a.id}:${d.id}">Enviar renovação</button>`
        : `<span class="selo selo-entregue">Em dia · até ${dataDaqui(d.validade)}</span>`;
    }
    return `<tr><td>${esc(d.nome)}<br><small>${esc(d.desc)}</small></td><td>${esc(d.numero)}</td><td>${esc(d.quem)}</td><td class="sit">${sit}</td></tr>`;
  }).join('')}</tbody>
        </table>
      </div>`).join('')}
    <div class="bloco-loja">
      <h2>🌡️ Temperaturas que o CortaÊ exige <small>Portaria CVS 3/2026 (São Paulo)</small></h2>
      <table class="tabela"><tbody>${TEMPERATURAS.map(([o, v]) => `<tr><td>${esc(o)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
      <p class="dica-painel">Levantamento do plano de negócio; não substitui a confirmação com a Vigilância Sanitária de Santos. ${esc(EMPRESA.razao)}.</p>
    </div>`;
}

function renderAlertas() {
  const venc = docsVencendo().filter(({ a }) => lojasDoFiltro().includes(a));
  const atrasados = doFiltro(pedidos).filter((p) => p.status === 'recebido' && aceiteAtrasado(p));
  const reclam = doFiltro(pedidos).filter(reclamacaoAberta);
  $alertas.innerHTML = [
    ...atrasados.map((p) => `<div class="alerta-p perigo">⏱️ Pedido #${p.numero} passou do prazo de aceite. A equipe CortaÊ foi avisada: aceite ou recuse agora.</div>`),
    ...reclam.map((p) => `<div class="alerta-p perigo">💬 Reclamação no pedido #${p.numero} (${esc(p.extras.reclamacao.motivo)}). Veja em Concluídos.</div>`),
    ...venc.map(({ a, d }) => `<div class="alerta-p">📄 ${esc(a.nome)}: ${esc(d.nome)} vence em ${d.validade} dias. Renove para não ser suspenso. <button class="link" data-ir="documentos">Ver documentos</button></div>`),
  ].join('');
}

function render() {
  renderPedidos();
  renderAssinaturas();
  renderEstoque();
  renderRepasse();
  renderDocumentos();
  renderAlertas();
}

function irPara(nova) {
  aba = nova;
  document.querySelectorAll('.aba-p').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === aba));
  document.querySelectorAll('[data-secao]').forEach((s) => s.classList.toggle('oculto', s.dataset.secao !== aba));
}

function atualizarRelogios() {
  for (const p of pedidos) {
    if (p.status === 'saiu') {
      const seg = document.querySelector(`[data-seg="${p.id}"]`);
      const barra = document.querySelector(`[data-barra="${p.id}"]`);
      if (seg) seg.textContent = `${segundosRestantes(p)}s`;
      if (barra) barra.style.width = `${Math.round(progressoEntrega(p) * 100)}%`;
    }
    if (p.status === 'recebido') {
      const el = document.querySelector(`[data-aceite="${p.id}"]`);
      if (!el) continue;
      const estourou = aceiteAtrasado(p);
      if (estourou !== el.classList.contains('atrasado')) { renderPedidos(); renderAlertas(); return; } // muda o cartão inteiro
      if (!estourou) el.querySelector('b').textContent = mmss(segundosParaAceite(p));
    }
  }
}

// Recargas podem se cruzar (clique, eco do tempo real, recarga de segurança): só vale a resposta da mais nova.
let ultimaCarga = 0;
async function recarregar() {
  const minha = ++ultimaCarga;
  const dados = await Promise.all([api.listarPedidos(), api.listarAssinaturas(), api.listarEsgotados()]);
  if (minha !== ultimaCarga) return false;
  let lista;
  [pedidos, assinaturas, lista] = dados;
  esgotados = new Set(lista.map((x) => x.produto_id));
  const ids = new Set(pedidos.map((p) => p.id));
  if (conhecidos) {
    const chegaram = doFiltro(pedidos).filter((p) => !conhecidos.has(p.id) && p.status === 'recebido');
    chegaram.forEach((p) => {
      novos.add(p.id);
      setTimeout(() => novos.delete(p.id), 8000);
      toast(`🔔 Novo pedido #${p.numero} · ${p.cliente_nome} · ${dinheiro(p.total)}`, 'ok');
    });
    let tocar = chegaram.length > 0;
    for (const p of doFiltro(pedidos)) {
      const antes = extrasConhecidos.get(p.id) || {};
      if (p.extras?.reclamacao && !antes.reclamacao) { toast(`💬 Reclamação no pedido #${p.numero}: ${p.extras.reclamacao.motivo}`, 'erro'); tocar = true; }
      if (p.extras?.avaliacao && !antes.avaliacao) toast(`⭐ Pedido #${p.numero} avaliado: açougue ${p.extras.avaliacao.acougue}/5`, 'ok');
    }
    if (tocar) tocarAviso();
  }
  conhecidos = ids;
  extrasConhecidos = new Map(pedidos.map((p) => [p.id, { reclamacao: !!p.extras?.reclamacao, avaliacao: !!p.extras?.avaliacao }]));
  return true;
}

document.addEventListener('click', async (e) => {
  const aba1 = e.target.closest('[data-aba]');
  if (aba1) { irPara(aba1.dataset.aba); return; }
  const ir = e.target.closest('[data-ir]');
  if (ir) { irPara(ir.dataset.ir); return; }
  const el = e.target.closest('[data-acao]');
  if (!el) return;
  const { acao, id } = el.dataset;
  el.disabled = true;
  try {
    if (acao === 'aceitar') await api.mudarStatus(id, 'preparando', 'recebido');
    if (acao === 'despachar') await api.mudarStatus(id, 'saiu', 'preparando');
    if (acao === 'recusar') {
      const p = pedidos.find((x) => x.id === id);
      const pago = p && p.pagamento !== 'dinheiro';
      const ok = await confirmar({ titulo: 'Recusar este pedido?', texto: pago ? `O cliente será avisado e receberá o estorno de ${dinheiro(p.total)}.` : 'O cliente será avisado e nada será cobrado.', ok: 'Recusar', perigo: true });
      if (!ok) { el.disabled = false; return; }
      await api.mudarStatus(id, 'recusado', 'recebido');
    }
    if (acao === 'estornar') {
      const p = pedidos.find((x) => x.id === id);
      const ok = await confirmar({ titulo: `Aprovar estorno de ${dinheiro(p.total)}?`, texto: `Reclamação: ${p.extras.reclamacao.motivo}. O valor volta ao cliente e sai do repasse.`, ok: 'Aprovar estorno', perigo: true });
      if (!ok) { el.disabled = false; return; }
      const em = new Date(agora()).toISOString();
      await api.atualizarExtras(id, {
        estorno: { valor: p.total, motivo: p.extras.reclamacao.motivo, em },
        chat: [...(p.extras.chat || []), { de: 'cortae', texto: `Boa notícia: o ${acougue(p.acougue_id).nome} aprovou o estorno de ${dinheiro(p.total)}. O valor volta pelo mesmo meio de pagamento.`, em }],
      });
    }
    if (acao === 'brinde-entregue') {
      const s = assinaturas.find((x) => x.id === id);
      if (s?.extras?.brinde) {
        await api.atualizarAssinatura(id, {
          extras: { ...s.extras, brinde: { ...s.extras.brinde, status: 'entregue', entregue_em: new Date(agora()).toISOString() } },
        });
        toast(`Presente ${s.extras.brinde.nome} entregue`, 'ok');
      }
    }
    if (acao === 'esgotar') {
      await api.marcarEsgotado(id, el.dataset.loja, !esgotados.has(id));
    }
    if (acao === 'renovar') {
      renovados.add(id);
      try { localStorage.setItem(CHAVE_RENOVADOS, JSON.stringify([...renovados])); } catch { /* sem armazenamento */ }
      toast('Renovação enviada. O CortaÊ confere e atualiza a validade.', 'ok');
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
  const ok = await confirmar({ titulo: 'Zerar a demonstração?', texto: 'Apaga pedidos, assinaturas, estoque e cadastros de parceiros, em todos os aparelhos.', ok: 'Zerar tudo', perigo: true });
  if (!ok) return;
  await api.zerar();
  renovados.clear();
  try { localStorage.removeItem(CHAVE_RENOVADOS); } catch { /* sem armazenamento */ }
  toast('Demonstração zerada', 'ok');
});

async function iniciar() {
  api = await db();
  await recarregar();
  render();
  api.ouvir(async (msg) => {
    const antes = JSON.stringify([pedidos, assinaturas, [...esgotados]]);
    try {
      if (!(await recarregar())) return; // uma recarga mais nova vai desenhar
    } catch (e) {
      if (msg?.tipo === 'sync') { console.warn(e); return; } // sem rede: a próxima recarga tenta de novo, sem toast
      throw e;
    }
    if (msg?.tipo === 'sync' && antes === JSON.stringify([pedidos, assinaturas, [...esgotados]])) return; // nada mudou
    render();
  });
  setInterval(atualizarRelogios, 500);
  setInterval(() => concluirEntregasVencidas(api, pedidos).catch(() => {}), 1000);
  // "há N s" / "há N min": troca só o texto, sem redesenhar os cartões (redesenhar engolia cliques).
  setInterval(() => document.querySelectorAll('[data-tempo]').forEach((el) => { el.textContent = tempoDesde(el.dataset.tempo); }), 1000);
  if (api.fonte === 'local') toast('Modo local: abra o app do cliente neste mesmo navegador.', '');
}

iniciar();
