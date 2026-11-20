// Fachada de dados: as telas só falam com esta interface, nunca com localStorage ou Supabase direto.
// Duas implementações com a mesma assinatura: db-local.js (navegador) e db-supabase.js (tempo real).
//
// Pedido:     { id, numero, criado_em, cliente_id, cliente_nome, endereco, acougue_id, itens[], subtotal,
//               taxa, total, pagamento, status, historico[{status, em}], saiu_em, entregue_em }
// Assinatura: { id, criado_em, cliente_id, cliente_nome, endereco, plano_id, frequencia, dia_semana,
//               acougue_id, status ('ativa'|'pausada'|'cancelada'), proxima_entrega }
//
// Interface: listarPedidos, obterPedido, criarPedido, mudarStatus(id, novo, deStatus?),
//            listarAssinaturas, criarAssinatura, atualizarAssinatura(id, campos), zerar, ouvir(fn),
//            diferencaRelogio() (ms entre a hora do servidor e a deste aparelho; 0 no modo local)
// ouvir(fn) também é chamado com { tipo: 'sync' } quando a tela volta a ficar visível ou a rede volta,
// para a tela recarregar o que pode ter perdido enquanto o aparelho dormia.
import { CONFIG, DATA_SOURCE } from './config.js';
import { ajustarRelogio } from './relogio.js';

let promessa;

export function db() {
  if (!promessa) {
    promessa = (DATA_SOURCE === 'supabase'
      ? import('./db-supabase.js').then((m) => m.criar(CONFIG))
      : import('./db-local.js').then((m) => m.criar()))
      .then((api) => {
        // Acerta o relógio em paralelo, sem atrasar a primeira tela; sem resposta, vale a hora do aparelho.
        api.diferencaRelogio().then(ajustarRelogio).catch(() => {});
        return api;
      });
  }
  return promessa;
}

export function novoId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
