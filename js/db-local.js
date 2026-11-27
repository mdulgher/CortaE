// Implementação local: localStorage + BroadcastChannel.
// Sincroniza só entre abas do MESMO navegador. Serve para ensaiar sem internet e sem Supabase.
import { novoId } from './db.js?v=0.3.2';
import { agoraISO } from './relogio.js?v=0.3.2';

const CHAVES = {
  pedidos: 'cortae.pedidos', assinaturas: 'cortae.assinaturas',
  esgotados: 'cortae.esgotados', parceiros: 'cortae.parceiros',
};

function ler(tabela) {
  try { return JSON.parse(localStorage.getItem(CHAVES[tabela]) || '[]'); } catch { return []; }
}
function gravar(tabela, lista) {
  localStorage.setItem(CHAVES[tabela], JSON.stringify(lista));
}
const recentes = (a, b) => (a.criado_em < b.criado_em ? 1 : -1);

export function criar() {
  const ouvintes = new Set();
  const canal = 'BroadcastChannel' in window ? new BroadcastChannel('cortae') : null;
  const avisar = (msg, propagar = true) => {
    ouvintes.forEach((fn) => { try { fn(msg); } catch (e) { console.error(e); } });
    if (propagar && canal) canal.postMessage(msg);
  };
  canal?.addEventListener('message', (e) => avisar(e.data, false));
  if (!canal) {
    window.addEventListener('storage', (e) => {
      const tabela = Object.keys(CHAVES).find((k) => CHAVES[k] === e.key);
      if (tabela) avisar({ tabela, tipo: 'sync' }, false);
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') avisar({ tabela: '*', tipo: 'sync' }, false);
  });

  return {
    fonte: 'local',

    async listarPedidos() { return ler('pedidos').sort(recentes); },
    async obterPedido(id) { return ler('pedidos').find((p) => p.id === id) || null; },

    async criarPedido(dados) {
      const lista = ler('pedidos');
      const em = agoraISO();
      const p = {
        ...dados,
        id: novoId(),
        numero: lista.reduce((m, x) => Math.max(m, x.numero || 0), 0) + 1,
        criado_em: em,
        status: 'recebido',
        historico: [{ status: 'recebido', em }],
        saiu_em: null,
        entregue_em: null,
        extras: {},
      };
      lista.push(p);
      gravar('pedidos', lista);
      avisar({ tabela: 'pedidos', tipo: 'insert', registro: p });
      return p;
    },

    // deStatus: só muda se o pedido ainda estiver nesse status (evita gravar "entregue" duas vezes).
    async mudarStatus(id, novo, deStatus) {
      const lista = ler('pedidos');
      const p = lista.find((x) => x.id === id);
      if (!p) return null;
      if (deStatus && p.status !== deStatus) return p;
      if (p.status === novo) return p;
      const em = agoraISO();
      p.status = novo;
      p.historico = [...(p.historico || []), { status: novo, em }];
      if (novo === 'saiu') p.saiu_em = em;
      if (novo === 'entregue') p.entregue_em = em;
      gravar('pedidos', lista);
      avisar({ tabela: 'pedidos', tipo: 'update', registro: p });
      return p;
    },

    // Junta campos em pedido.extras (avaliação, conferência, chat, reclamação, estorno).
    async atualizarExtras(id, campos) {
      const lista = ler('pedidos');
      const p = lista.find((x) => x.id === id);
      if (!p) return null;
      p.extras = { ...(p.extras || {}), ...campos };
      gravar('pedidos', lista);
      avisar({ tabela: 'pedidos', tipo: 'update', registro: p });
      return p;
    },

    async listarAssinaturas() { return ler('assinaturas').sort(recentes); },

    async criarAssinatura(dados) {
      const lista = ler('assinaturas');
      const a = { ...dados, id: novoId(), criado_em: agoraISO(), status: 'ativa' };
      lista.push(a);
      gravar('assinaturas', lista);
      avisar({ tabela: 'assinaturas', tipo: 'insert', registro: a });
      return a;
    },

    async atualizarAssinatura(id, campos) {
      const lista = ler('assinaturas');
      const a = lista.find((x) => x.id === id);
      if (!a) return null;
      Object.assign(a, campos);
      gravar('assinaturas', lista);
      avisar({ tabela: 'assinaturas', tipo: 'update', registro: a });
      return a;
    },

    async listarEsgotados() { return ler('esgotados'); },

    async marcarEsgotado(produtoId, acougueId, esgotado) {
      const lista = ler('esgotados').filter((x) => x.produto_id !== produtoId);
      if (esgotado) lista.push({ produto_id: produtoId, acougue_id: acougueId, criado_em: agoraISO() });
      gravar('esgotados', lista);
      avisar({ tabela: 'esgotados', tipo: 'update' });
    },

    async listarParceiros() { return ler('parceiros').sort(recentes); },

    async criarParceiro(dados) {
      const lista = ler('parceiros');
      const c = { etapa: 1, status: 'cadastro', ...dados, id: novoId(), criado_em: agoraISO() };
      lista.push(c);
      gravar('parceiros', lista);
      avisar({ tabela: 'parceiros', tipo: 'insert', registro: c });
      return c;
    },

    async atualizarParceiro(id, campos) {
      const lista = ler('parceiros');
      const c = lista.find((x) => x.id === id);
      if (!c) return null;
      Object.assign(c, campos);
      gravar('parceiros', lista);
      avisar({ tabela: 'parceiros', tipo: 'update', registro: c });
      return c;
    },

    async zerar() {
      Object.keys(CHAVES).forEach((t) => gravar(t, []));
      avisar({ tabela: '*', tipo: 'reset' });
    },

    // Todas as abas usam o relógio deste mesmo computador: não há diferença a corrigir.
    async diferencaRelogio() { return 0; },

    ouvir(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },
  };
}
