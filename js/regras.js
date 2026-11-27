// Regras do serviço usadas pelas três telas (pontos críticos do blueprint da Karla).
import { CONFIG } from './config.js?v=0.3.1';
import { agora } from './relogio.js?v=0.3.1';
import { esc } from './ui.js?v=0.3.1';

// Prazo máximo de aceite: segundos que faltam (negativo = estourou).
export function segundosParaAceite(p) {
  if (p.status !== 'recebido') return null;
  return Math.ceil(CONFIG.ACEITE_SEGUNDOS - (agora() - new Date(p.criado_em).getTime()) / 1000);
}
export const aceiteAtrasado = (p) => (segundosParaAceite(p) ?? 1) <= 0;
export const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

// Estorno: reclamação aprovada, ou pedido pago (Pix/cartão) que o açougue recusou.
export function estornoDe(p) {
  if (p.extras?.estorno) return p.extras.estorno;
  if (p.status === 'recusado' && p.pagamento !== 'dinheiro') {
    return { valor: p.total, motivo: 'Pedido recusado pelo açougue', em: p.historico?.at(-1)?.em, automatico: true };
  }
  return null;
}

// Minutos entre o pedido e a entrega (a demo leva segundos, então costuma dar "1 min").
export function minutosDeEntrega(p) {
  if (!p.entregue_em) return null;
  return Math.max(1, Math.round((new Date(p.entregue_em) - new Date(p.criado_em)) / 60000));
}

export const MOTIVOS = {
  temperatura: 'Carne chegou fora da temperatura',
  faltou: 'Faltou item ou veio errado',
};

export function estrelas(n, classe = '') {
  const cheia = Math.round(n);
  return `<span class="estrelas ${classe}" aria-label="${n} de 5 estrelas">${'★'.repeat(cheia)}<i>${'★'.repeat(5 - cheia)}</i></span>`;
}

export function htmlAvaliacao(av) {
  if (!av) return '';
  return `<div class="avaliacao-mini">
    <span>Açougue ${estrelas(av.acougue)}</span><span>Entrega ${estrelas(av.entrega)}</span>
    ${av.comentario ? `<q>${esc(av.comentario)}</q>` : ''}</div>`;
}

// Dias até um documento vencer, a partir de "daqui a N dias" do catálogo fictício (ou de uma data ISO).
export function diasPara(valor) {
  if (typeof valor === 'number') return valor;
  return Math.ceil((new Date(valor).getTime() - agora()) / 86400000);
}
export function dataDaqui(dias) {
  return new Date(agora() + dias * 86400000).toLocaleDateString('pt-BR');
}
