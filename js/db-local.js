// Implementação local: localStorage + BroadcastChannel.
// Sincroniza só entre abas do MESMO navegador. Serve para ensaiar sem internet e sem Supabase.
import { novoId } from './db.js';

const CHAVES = { pedidos: 'cortae.pedidos', assinaturas: 'cortae.assinaturas' };

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

  return {
    fonte: 'local',

    async listarPedidos() { return ler('pedidos').sort(recentes); },
    async obterPedido(id) { return ler('pedidos').find((p) => p.id === id) || null; },

    async criarPedido(dados) {
      const lista = ler('pedidos');
      const em = new Date().toISOString();
      const p = {
        ...dados,
        id: novoId(),
        numero: lista.reduce((m, x) => Math.max(m, x.numero || 0), 0) + 1,
        criado_em: em,
        status: 'recebido',
        historico: [{ status: 'recebido', em }],
        saiu_em: null,
        entregue_em: null,
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
      const em = new Date().toISOString();
      p.status = novo;
      p.historico = [...(p.historico || []), { status: novo, em }];
      if (novo === 'saiu') p.saiu_em = em;
      if (novo === 'entregue') p.entregue_em = em;
      gravar('pedidos', lista);
      avisar({ tabela: 'pedidos', tipo: 'update', registro: p });
      return p;
    },

    async listarAssinaturas() { return ler('assinaturas').sort(recentes); },

    async criarAssinatura(dados) {
      const lista = ler('assinaturas');
      const a = { ...dados, id: novoId(), criado_em: new Date().toISOString(), status: 'ativa' };
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

    async zerar() {
      gravar('pedidos', []);
      gravar('assinaturas', []);
      avisar({ tabela: '*', tipo: 'reset' });
    },

    ouvir(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },
  };
}
