// "Seja parceiro": cadastro do açougue em 6 etapas (blueprint 4.1 e requisitos 4.2 do plano de negócio).
// Tudo encenado: nenhum documento é enviado de verdade e os dados de exemplo são fictícios.
import { db } from './db.js?v=0.3.1';
import { BASE, CATEGORIAS, REQUISITOS, PLANOS_PARCEIRO, ETAPAS_PARCEIRO, TEMPERATURAS, EMPRESA, planoParceiro } from './catalogo.js?v=0.3.1';
import { CONFIG } from './config.js?v=0.3.1';
import { esc, dinheiro, iniciarTema, toast, vigiarErros } from './ui.js?v=0.3.1';
import { dataDaqui } from './regras.js?v=0.3.1';
import { ic, pintarIcones } from './icones.js?v=0.3.1';

vigiarErros();
iniciarTema();
pintarIcones();

const $etapas = document.getElementById('etapas');
const $corpo = document.getElementById('corpo');
const CHAVE = 'cortae.parceiro.id';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const EXEMPLO = {
  nome: 'Açougue Bom Corte', razao: 'Bom Corte Comércio de Carnes Ltda.', cnpj: '56.789.012/0001-34',
  endereco: 'Rua Azevedo Sodré, 45 — Gonzaga, Santos - SP', bairro: 'Gonzaga', responsavel: 'Responsável fictício',
};
const TREINOS = [
  { id: 'painel', nome: 'Painel de pedidos', desc: `Aceitar em até ${CONFIG.ACEITE_SEGUNDOS / 60} min, recusar com estorno automático, marcar corte esgotado` },
  { id: 'embalagem', nome: 'Embalagem térmica e lacre', desc: 'Toda entrega sai em caixa térmica lacrada; o cliente confere o lacre na porta' },
  { id: 'temperaturas', nome: 'Temperaturas (CVS 3/2026)', desc: 'Armazenar a até 4 °C; transporte fechado e pré-resfriado' },
];

let api;
let cad = null;        // cadastro atual (do banco)
let validando = false; // animação da etapa 3 em andamento

function lerId() { try { return localStorage.getItem(CHAVE); } catch { return null; } }
function gravarId(id) { try { if (id) localStorage.setItem(CHAVE, id); else localStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ } }

async function salvar(campos, dados = {}) {
  cad = await api.atualizarParceiro(cad.id, { ...campos, dados: { ...cad.dados, ...dados } });
  render();
}

// ---------- Etapas ----------
function stepper() {
  const atual = cad?.etapa || 1;
  $etapas.innerHTML = ETAPAS_PARCEIRO.map((e) => `
    <div class="etapa ${e.n < atual || cad?.status === 'ativo' ? 'feita' : ''} ${e.n === atual && cad?.status !== 'ativo' ? 'atual' : ''}">
      <b>${e.n < atual || cad?.status === 'ativo' ? '✓' : e.n}</b><span>${esc(e.nome)}<small>${esc(e.desc)}</small></span>
    </div>`).join('');
}

function etapa1() {
  const d = cad?.dados || {};
  return `
    <section class="cad-intro">
      <h2>Venda online sem abrir loja nova</h2>
      <p>O CortaÊ leva os cortes do seu açougue para o celular de quem mora em Santos. Você cuida da carne; a gente cuida da vitrine, do pagamento, da entrega e do atendimento.</p>
      <div class="vantagens">
        <span>📱 Vitrine no app com selo de verificado</span><span>🛵 Entregadores CortaÊ</span>
        <span>💳 Pagamento com antifraude e repasse</span><span>🔄 Clientes de assinatura</span>
      </div>
    </section>
    <form class="cartao cad-form" id="form1">
      <h2 class="subtitulo">1. Conhecer e se inscrever</h2>
      <div class="grade2">
        <label class="campo">Nome do açougue<input name="nome" required maxlength="60" value="${esc(d.nome || '')}"></label>
        <label class="campo">Razão social<input name="razao" required maxlength="80" value="${esc(d.razao || '')}"></label>
        <label class="campo">CNPJ<input name="cnpj" required maxlength="18" inputmode="numeric" placeholder="00.000.000/0000-00" value="${esc(d.cnpj || '')}"></label>
        <label class="campo">Bairro<input name="bairro" required maxlength="40" value="${esc(d.bairro || '')}"></label>
        <label class="campo largo">Endereço<input name="endereco" required maxlength="120" value="${esc(d.endereco || '')}"></label>
        <label class="campo largo">Responsável legal<input name="responsavel" required maxlength="60" value="${esc(d.responsavel || '')}"></label>
      </div>
      <p class="dica-painel">Atividade exigida: comércio varejista de carnes (CNAE 4722-9/01). Por enquanto o CortaÊ atende só Santos.</p>
      <div class="acoes-cad">
        <button type="button" class="btn btn-sec" data-acao="exemplo">Preencher com exemplo fictício</button>
        <button type="submit" class="btn btn-pri">Enviar inscrição ${ic('seta')}</button>
      </div>
    </form>`;
}

function etapa2() {
  const docs = cad.dados.docs || {};
  const faltam = REQUISITOS.filter((r) => r.id !== 'cnpj' && !docs[r.id]);
  return `
    <section class="cartao">
      <h2 class="subtitulo">2. Enviar documentos</h2>
      <p class="dica-painel">O açougue precisa estar regular em três frentes: empresa, vigilância sanitária e origem da carne.
        ${faltam.length ? `<b>Falta enviar: ${faltam.length}.</b>` : '<b>Tudo enviado.</b>'}</p>
      <div class="docs-lista">${REQUISITOS.map((r) => {
    const enviado = r.id === 'cnpj' || docs[r.id];
    return `<div class="doc ${enviado ? 'ok' : ''}">
          <span class="doc-ico">${enviado ? '✓' : '📄'}</span>
          <span><b>${esc(r.nome)}</b><small>${esc(r.desc)} · ${esc(r.quem)}</small>
            ${enviado ? `<small class="arquivo">${r.id === 'cnpj' ? `Informado na inscrição: ${esc(cad.dados.cnpj)}` : esc(docs[r.id])}</small>` : ''}</span>
          ${enviado ? '' : `<button class="btn btn-sec" data-acao="enviar-doc" data-id="${r.id}">Enviar</button>`}
        </div>`;
  }).join('')}</div>
      <div class="acoes-cad"><button class="btn btn-pri" data-acao="para-analise" ${faltam.length ? 'disabled' : ''}>Enviar para análise ${ic('seta')}</button></div>
      <p class="aviso-demo">Demonstração: nenhum arquivo é enviado de verdade.</p>
    </section>`;
}

const CHECAGENS = [
  { id: 'cnpj', txt: 'Consulta do CNPJ na Receita Federal', ok: 'CNPJ ativo · CNAE 4722-9/01' },
  { id: 'area', txt: 'Endereço dentro da área atendida', ok: 'Santos (SP)' },
  { id: 'alvara', txt: 'Alvará de funcionamento', ok: `Válido até ${dataDaqui(300)}` },
  { id: 'licenca', txt: 'Licença sanitária (SEVISA)', ok: `Válida até ${dataDaqui(365)}` },
  { id: 'origem', txt: 'Origem da carne inspecionada', ok: 'Fornecedor com selo SIF confirmado' },
  { id: 'boaspraticas', txt: 'Manual de boas práticas', ok: 'Assinado pelo responsável técnico', pendencia: 'Manual sem a assinatura do responsável técnico' },
  { id: 'banco', txt: 'Conta bancária no CNPJ', ok: 'Titularidade confere' },
];

function etapa3() {
  const corrigida = !!cad.dados.pendencia_corrigida;
  const aprovado = !!cad.dados.validado;
  return `
    <section class="cartao">
      <h2 class="subtitulo">3. Validação</h2>
      <p class="dica-painel">Ponto de controle mais importante: o açougue só é ativado depois que o CortaÊ confere CNPJ, licença sanitária e origem inspecionada da carne.</p>
      <ul class="validacao" id="validacao">${CHECAGENS.map((c) => {
    const pend = c.pendencia && !corrigida;
    const feito = aprovado || (cad.dados.checado && !(c.pendencia && corrigida)); // item corrigido espera a reanálise
    return `<li class="${feito ? (pend ? 'pend' : 'ok') : ''}" data-chk="${c.id}"><span class="marca"></span><span>${esc(c.txt)}<small>${feito ? esc(pend ? c.pendencia : c.ok) : 'aguardando'}</small></span></li>`;
  }).join('')}</ul>
      <div id="validacao-fim">${htmlFimValidacao()}</div>
    </section>`;
}
function htmlFimValidacao() {
  if (cad.dados.validado) {
    return `<div class="resultado ok">✉️ Aprovado! Enviamos o resultado da análise para o e-mail do responsável.</div>
      <div class="acoes-cad"><button class="btn btn-pri" data-acao="ir" data-n="4">Continuar para o contrato ${ic('seta')}</button></div>`;
  }
  if (cad.dados.checado && !cad.dados.pendencia_corrigida) {
    return `<div class="resultado pend">⚠ 1 pendência a corrigir. O analista avisou por e-mail.</div>
      <div class="acoes-cad"><button class="btn btn-ama" data-acao="corrigir">Corrigir e reenviar o manual</button></div>`;
  }
  return '<div class="resultado">🔎 Equipe CortaÊ analisando os documentos…</div>';
}
async function rodarValidacao() {
  if (validando || cad.dados.validado) return;
  validando = true;
  const corrigida = !!cad.dados.pendencia_corrigida;
  for (const c of CHECAGENS) {
    if (corrigida && c.id !== 'boaspraticas') continue; // na reanálise só o item corrigido
    const li = document.querySelector(`[data-chk="${c.id}"]`);
    li?.classList.add('rodando');
    await esperar(550);
    if (!li) break;
    const pend = c.pendencia && !corrigida;
    li.classList.remove('rodando');
    li.classList.add(pend ? 'pend' : 'ok');
    li.querySelector('small').textContent = pend ? c.pendencia : c.ok;
  }
  validando = false;
  await salvar({}, corrigida ? { checado: true, validado: true } : { checado: true });
}

function etapa4() {
  const d = cad.dados;
  const escolhido = d.plano || 'entrega';
  const treino = d.treino || {};
  if (!d.contrato_em) {
    return `
      <section class="cartao">
        <h2 class="subtitulo">4. Contrato e treinamento</h2>
        <p class="dica-painel">Escolha o plano. Valores de referência (planos do iFood citados no plano de negócio), a definir pelo grupo.</p>
        <div class="planos-parc">${PLANOS_PARCEIRO.map((p) => `
          <button class="plano-parc ${escolhido === p.id ? 'ativo' : ''}" data-acao="plano" data-id="${p.id}">
            <b>Plano ${esc(p.nome)}</b>
            <strong>${Math.round(p.comissao * 100)}%<small> por pedido</small></strong>
            <span>+ ${String(p.pagOnline * 100).replace('.', ',')}% no pagamento online</span>
            <span>Mensalidade ${dinheiro(p.mensalidade)} (vendas acima de R$ 1.800/mês)</span>
            <span>🛵 ${esc(p.entrega)}</span>
          </button>`).join('')}</div>
        <div class="termos">
          <h3>O que o contrato pede</h3>
          <ul class="checklist">
            <li>✔︎ Manter a regularidade fiscal e sanitária enquanto estiver na plataforma</li>
            <li>✔︎ Comprar carne só de frigorífico com selo SIF, SISP ou SIM</li>
            <li>✔︎ Aceitar ou recusar pedidos em até ${CONFIG.ACEITE_SEGUNDOS / 60} min</li>
            <li>✔︎ Entregar em embalagem térmica lacrada (padrão CortaÊ)</li>
            <li>✔︎ Aparecer no app com razão social e CNPJ (Decreto 7.962/2013)</li>
          </ul>
          <label class="aceite"><input type="checkbox" id="aceite"> Li e aceito o contrato de parceria (demonstração)</label>
        </div>
        <div class="acoes-cad"><button class="btn btn-pri" data-acao="assinar">✍️ Assinar eletronicamente</button></div>
      </section>`;
  }
  const feitos = TREINOS.filter((t) => treino[t.id]).length;
  return `
    <section class="cartao">
      <h2 class="subtitulo">4. Contrato e treinamento</h2>
      <div class="resultado ok">✍️ Contrato assinado · Plano ${esc(planoParceiro(d.plano).nome)} (${Math.round(planoParceiro(d.plano).comissao * 100)}%). O kit de embalagem térmica vai para o açougue.</div>
      <h3 class="tit-treino">Treinamento (${feitos} de ${TREINOS.length})</h3>
      <div class="docs-lista">${TREINOS.map((t) => `
        <div class="doc ${treino[t.id] ? 'ok' : ''}">
          <span class="doc-ico">${treino[t.id] ? '✓' : '🎓'}</span>
          <span><b>${esc(t.nome)}</b><small>${esc(t.desc)}</small></span>
          ${treino[t.id] ? '' : `<button class="btn btn-sec" data-acao="treino" data-id="${t.id}">Concluir</button>`}
        </div>`).join('')}</div>
      <div class="acoes-cad"><button class="btn btn-pri" data-acao="ir" data-n="5" ${feitos < TREINOS.length ? 'disabled' : ''}>Montar a vitrine ${ic('seta')}</button></div>
    </section>`;
}

const PADRAO_VITRINE = ['picanha', 'alcatra', 'fraldinha', 'costela', 'coxa', 'toscana', 'kit-churrasco', 'carvao'];
function etapa5() {
  const sel = new Set(cad.dados.vitrine || PADRAO_VITRINE);
  const horario = cad.dados.horario || '08:00 às 19:00';
  return `
    <section class="cartao">
      <h2 class="subtitulo">5. Montar a vitrine</h2>
      <p class="dica-painel">Escolha os cortes, kits e outros produtos. O CortaÊ padroniza fotos e descrições e revisa a loja antes de publicar.</p>
      <div class="vitrine-cats">${CATEGORIAS.map((c) => `
        <fieldset><legend>${c.icone} ${esc(c.nome)}</legend>
          ${BASE.filter((b) => b.cat === c.id).map((b) => `
            <label class="opc"><input type="checkbox" data-vitrine="${b.b}" ${sel.has(b.b) ? 'checked' : ''}> ${esc(b.nome)} <small>${dinheiro(b.preco)}</small></label>`).join('')}
        </fieldset>`).join('')}</div>
      <label class="campo horario">Horário de funcionamento
        <select id="horario">${['08:00 às 19:00', '07:00 às 20:00', '09:00 às 18:00'].map((h) => `<option ${h === horario ? 'selected' : ''}>${h}</option>`).join('')}</select></label>
      <div class="previa">
        <span class="ico">🥩</span>
        <div><b>${esc(cad.dados.nome)} <span class="verificado">✔︎</span></b><small>${esc(cad.dados.bairro)} · ${esc(horario)} · <span id="qtd-vitrine">${sel.size}</span> produtos</small></div>
      </div>
      <div id="revisao"></div>
      <div class="acoes-cad"><button class="btn btn-pri" data-acao="publicar">Enviar para revisão e publicar ${ic('seta')}</button></div>
    </section>`;
}

function etapa6() {
  const d = cad.dados;
  const pl = planoParceiro(d.plano);
  return `
    <section class="cartao sucesso">
      <span class="grande">🎉</span>
      <h2>${esc(d.nome)} já está no CortaÊ!</h2>
      <p>Loja publicada com selo de verificado, ${(d.vitrine || PADRAO_VITRINE).length} produtos e horário ${esc(d.horario || '08:00 às 19:00')}.</p>
      <div class="acoes-cad centro">
        <a class="btn btn-pri" href="acougue.html">Abrir o painel do açougue</a>
        <a class="btn btn-sec" href="index.html#/acougues">Ver no app</a>
      </div>
    </section>
    <section class="cartao">
      <h2 class="subtitulo">6. Vender e renovar</h2>
      <div class="grade2">
        <div><h3>No dia a dia</h3><ul class="checklist">
          <li>🔔 Aceitar pedidos em até ${CONFIG.ACEITE_SEGUNDOS / 60} min (depois disso a equipe CortaÊ é alertada)</li>
          <li>📦 Marcar no painel o corte que esgotou</li>
          <li>💬 Suporte ao parceiro pelo chat do painel</li>
          <li>💰 Extrato de repasses: ${Math.round(pl.comissao * 100)}% de comissão + ${String(pl.pagOnline * 100).replace('.', ',')}% no pagamento online</li>
        </ul></div>
        <div><h3>Documentos acompanhados</h3><ul class="checklist">
          <li>📄 Alvará · vence em ${dataDaqui(300)}</li>
          <li>📄 Licença sanitária · vence em ${dataDaqui(365)}</li>
          <li>📄 Boas práticas · revisão em ${dataDaqui(180)}</li>
          <li>⏰ O painel avisa 30 dias antes de cada vencimento</li>
        </ul></div>
      </div>
      <h3 class="tit-treino">Temperaturas exigidas (CVS 3/2026)</h3>
      <table class="tabela"><tbody>${TEMPERATURAS.map(([o, v]) => `<tr><td>${esc(o)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
      <div class="acoes-cad"><button class="btn btn-sec" data-acao="novo">Cadastrar outro açougue</button></div>
      <p class="aviso-demo">Demonstração do TCC · dados fictícios · ${esc(EMPRESA.razao)}</p>
    </section>`;
}

function render() {
  stepper();
  const n = cad?.status === 'ativo' ? 6 : (cad?.etapa || 1);
  $corpo.innerHTML = [etapa1, etapa1, etapa2, etapa3, etapa4, etapa5, etapa6][n]();
  if (n === 3 && !cad.dados.validado && !(cad.dados.checado && !cad.dados.pendencia_corrigida)) rodarValidacao();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- Ações ----------
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'form1') return;
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(e.target).entries());
  Object.keys(dados).forEach((k) => { dados[k] = String(dados[k]).trim(); });
  if (dados.cnpj.replace(/\D/g, '').length !== 14) { toast('O CNPJ precisa ter 14 números.', 'erro'); return; }
  // Backstage da etapa 1: o CortaÊ confere se o endereço está na área atendida.
  if (!/santos/i.test(dados.endereco)) { toast('Por enquanto o CortaÊ atende só Santos (SP). Confira o endereço.', 'erro'); return; }
  const botao = e.target.querySelector('[type=submit]');
  botao.disabled = true;
  try {
    if (cad) await salvar({ etapa: 2 }, dados);
    else {
      cad = await api.criarParceiro({ etapa: 2, status: 'cadastro', dados });
      gravarId(cad.id);
      toast('Inscrição recebida! A equipe comercial entra em contato.', 'ok');
      render();
    }
  } catch (err) { botao.disabled = false; throw err; }
});

document.addEventListener('change', (e) => {
  if (e.target.matches('[data-vitrine]')) {
    const qtd = document.querySelectorAll('[data-vitrine]:checked').length;
    document.getElementById('qtd-vitrine').textContent = qtd;
  }
});

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-acao]');
  if (!el) return;
  const { acao, id } = el.dataset;
  if (acao === 'exemplo') {
    const f = document.getElementById('form1');
    Object.entries(EXEMPLO).forEach(([k, v]) => { f.elements[k].value = v; });
    return;
  }
  if (acao === 'plano') {
    document.querySelectorAll('.plano-parc').forEach((b) => b.classList.toggle('ativo', b === el));
    cad.dados.plano = id; // vale ao assinar
    return;
  }
  el.disabled = true;
  try {
    if (acao === 'enviar-doc') {
      await esperar(400);
      await salvar({}, { docs: { ...(cad.dados.docs || {}), [id]: `${id}-${cad.dados.cnpj.replace(/\D/g, '').slice(0, 8)}.pdf · enviado` } });
    }
    if (acao === 'para-analise') await salvar({ etapa: 3, status: 'validacao' });
    if (acao === 'corrigir') {
      await salvar({}, { pendencia_corrigida: true, docs: { ...cad.dados.docs, boaspraticas: 'boas-praticas-assinado.pdf · reenviado' } });
    }
    if (acao === 'ir') await salvar({ etapa: Number(el.dataset.n) });
    if (acao === 'assinar') {
      if (!document.getElementById('aceite').checked) { toast('Marque "Li e aceito" para assinar.', 'erro'); el.disabled = false; return; }
      await salvar({}, { plano: cad.dados.plano || 'entrega', contrato_em: new Date().toISOString() });
      toast('Contrato assinado. Açougue ativado no sistema e comissão definida.', 'ok');
    }
    if (acao === 'treino') await salvar({}, { treino: { ...(cad.dados.treino || {}), [id]: true } });
    if (acao === 'publicar') {
      const vitrine = [...document.querySelectorAll('[data-vitrine]:checked')].map((x) => x.dataset.vitrine);
      if (!vitrine.length) { toast('Escolha pelo menos um produto.', 'erro'); el.disabled = false; return; }
      const horario = document.getElementById('horario').value;
      const rev = document.getElementById('revisao');
      rev.innerHTML = '<div class="resultado">📸 Equipe CortaÊ padronizando fotos e descrições…</div>';
      await esperar(900);
      rev.innerHTML = '<div class="resultado">🔎 Revisando preços e horários…</div>';
      await esperar(900);
      await salvar({ etapa: 6, status: 'ativo' }, { vitrine, horario });
      toast('Loja publicada! 🎉', 'ok');
    }
    if (acao === 'novo') {
      gravarId(null);
      cad = null;
      render();
    }
  } catch (err) {
    el.disabled = false;
    throw err;
  }
});

async function iniciar() {
  api = await db();
  const id = lerId();
  if (id) cad = (await api.listarParceiros()).find((c) => c.id === id) || null;
  if (!cad) gravarId(null);
  render();
  api.ouvir(async (msg) => {
    if (msg?.tipo !== 'reset' || !cad) return;
    // Demo zerada em outro aparelho: o cadastro sumiu, volta para o começo.
    const ainda = (await api.listarParceiros()).some((c) => c.id === cad.id);
    if (!ainda) { cad = null; gravarId(null); render(); toast('Demonstração zerada', 'ok'); }
  });
}

iniciar();
