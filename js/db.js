// Fachada de dados: as telas só falam com esta interface, nunca com localStorage ou Supabase direto.
// Duas implementações com a mesma assinatura: db-local.js (navegador) e db-supabase.js (tempo real).
//
// Pedido:     { id, numero, criado_em, cliente_id, cliente_nome, endereco, acougue_id, itens[], subtotal,
//               taxa, total, pagamento, status, historico[{status, em}], saiu_em, entregue_em, extras{} }
//             extras: { conferido_em, avaliacao{acougue, entrega, comentario, em}, chat[{de, texto, em}],
//                       reclamacao{motivo, em}, estorno{valor, motivo, em} }
// Esgotado:   { produto_id, acougue_id, criado_em }  (corte que o açougue marcou como sem estoque)
// Parceiro:   { id, criado_em, etapa (1..6), status ('cadastro'|'validacao'|'ativo'), dados{} }  (Seja parceiro)
// Assinatura: { id, criado_em, cliente_id, cliente_nome, endereco, plano_id, frequencia, dia_semana,
//               acougue_id, status ('ativa'|'pausada'|'cancelada'), proxima_entrega,
//               prazo ('mensal'|'semestral'|'anual'), extras{} }
//             extras: { periodo_inicio, renovacoes, brinde{nome, icone, status ('pendente'|'entregue'), em, entregue_em} }
//
// Interface: listarPedidos, obterPedido, criarPedido, mudarStatus(id, novo, deStatus?),
//            atualizarExtras(id, campos), listarAssinaturas, criarAssinatura, atualizarAssinatura(id, campos),
//            listarEsgotados, marcarEsgotado(produtoId, acougueId, esgotado),
//            listarParceiros, criarParceiro(dados), atualizarParceiro(id, campos), zerar, ouvir(fn),
//            diferencaRelogio() (ms entre a hora do servidor e a deste aparelho; 0 no modo local)
// ouvir(fn) também é chamado com { tipo: 'sync' } quando a tela volta a ficar visível ou a rede volta,
// para a tela recarregar o que pode ter perdido enquanto o aparelho dormia.
import { CONFIG, DATA_SOURCE } from './config.js?v=0.3.2';
import { ajustarRelogio } from './relogio.js?v=0.3.2';

let promessa;

export function db() {
  if (!promessa) {
    promessa = (DATA_SOURCE === 'supabase'
      ? import('./db-supabase.js?v=0.3.2').then((m) => m.criar(CONFIG))
      : import('./db-local.js?v=0.3.2').then((m) => m.criar()))
      .then((api) => {
        // Acerta o relógio em paralelo, sem atrasar a primeira tela. Se falhar (rede caiu na abertura),
        // vale a hora do aparelho e tenta de novo quando a rede voltar ou a tela reaparecer.
        // Uma medição por vez: ao abrir a página o navegador pode avisar "tela visível" várias vezes
        // antes de a primeira medição terminar, e cada aviso disparava outra (vimos cinco em paralelo).
        let medido = false;
        let medindo = false;
        const medir = () => {
          if (medido || medindo) return;
          medindo = true;
          api.diferencaRelogio()
            .then((ms) => { ajustarRelogio(ms); medido = true; })
            .catch((e) => console.warn('Relógio não sincronizado com o servidor:', e?.message || e))
            .finally(() => { medindo = false; });
        };
        medir();
        const tentarDeNovo = () => { if (document.visibilityState === 'visible') medir(); };
        window.addEventListener('online', tentarDeNovo);
        document.addEventListener('visibilitychange', tentarDeNovo);
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
