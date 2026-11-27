// Linha do tempo do pedido, usada no celular e na TV.
import { STATUS, ETAPAS } from './catalogo.js?v=0.3.1';
import { hora } from './ui.js?v=0.3.1';

export function htmlTimeline(p) {
  const quando = (st) => (p.historico || []).find((h) => h.status === st)?.em;
  if (p.status === 'recusado') {
    return `
      <li class="feito"><span class="bola">🧾</span><span class="rotulo">Pedido recebido</span><span class="quando">${hora(quando('recebido'))}</span></li>
      <li class="atual"><span class="bola">✖️</span><span class="rotulo">Recusado pelo açougue</span><span class="quando">${hora(quando('recusado'))}</span></li>`;
  }
  const idxAtual = ETAPAS.indexOf(p.status);
  return ETAPAS.map((st, i) => {
    const feito = i < idxAtual || p.status === 'entregue';
    const atual = i === idxAtual && p.status !== 'entregue';
    const recebido = p.pagamento === 'dinheiro' ? 'Pedido recebido · pagar na entrega' : 'Pedido recebido · pagamento aprovado';
    const rotulo = st === 'recebido' ? recebido : STATUS[st].nome;
    return `<li class="${feito ? 'feito' : ''} ${atual ? 'atual' : ''}">
      <span class="bola">${STATUS[st].icone}</span><span class="rotulo">${rotulo}</span><span class="quando">${hora(quando(st))}</span></li>`;
  }).join('');
}
