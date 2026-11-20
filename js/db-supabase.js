// Implementação Supabase: mesma interface do db-local.js, com tempo real entre aparelhos.
// Schema em supabase/schema.sql. Sem login: a demo usa a chave pública e tabelas abertas (decisão do dono).
import { agoraISO } from './relogio.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const SYNC_MS = 20000; // rede de segurança: recarrega a cada 20 s enquanto a tela está visível

export async function criar(CONFIG) {
  const { createClient } = await import(SUPABASE_JS);
  const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ouvintes = new Set();
  const avisar = (msg) => ouvintes.forEach((fn) => { try { fn(msg); } catch (e) { console.error(e); } });
  const sincronizar = () => avisar({ tabela: '*', tipo: 'sync' });

  const canal = sb.channel('cortae-demo');
  for (const tabela of ['pedidos', 'assinaturas']) {
    canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, (pl) => {
      avisar({ tabela, tipo: String(pl.eventType).toLowerCase(), registro: pl.new });
    });
  }
  canal.on('broadcast', { event: 'reset' }, () => avisar({ tabela: '*', tipo: 'reset' }));
  // Ao reconectar (celular que dormiu, Wi-Fi que caiu), as mudanças do intervalo não chegam: recarrega.
  let jaInscrito = false;
  canal.subscribe((estado) => {
    if (estado !== 'SUBSCRIBED') return;
    if (jaInscrito) sincronizar();
    jaInscrito = true;
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar(); });
  window.addEventListener('online', sincronizar);
  window.addEventListener('pageshow', (e) => { if (e.persisted) sincronizar(); });
  setInterval(() => { if (document.visibilityState === 'visible') sincronizar(); }, SYNC_MS);

  const ok = ({ data, error }) => { if (error) throw error; return data; };
  const obterPedido = async (id) => ok(await sb.from('pedidos').select('*').eq('id', id).maybeSingle());

  return {
    fonte: 'supabase',

    async listarPedidos() {
      return ok(await sb.from('pedidos').select('*').order('criado_em', { ascending: false }).limit(300));
    },
    obterPedido,

    async criarPedido(dados) {
      const em = agoraISO();
      const linha = { ...dados, status: 'recebido', historico: [{ status: 'recebido', em }] };
      return ok(await sb.from('pedidos').insert(linha).select().single());
    },

    async mudarStatus(id, novo, deStatus) {
      const atual = await obterPedido(id);
      if (!atual) return null;
      if (deStatus && atual.status !== deStatus) return atual;
      if (atual.status === novo) return atual;
      const em = agoraISO();
      const campos = { status: novo, historico: [...(atual.historico || []), { status: novo, em }] };
      if (novo === 'saiu') campos.saiu_em = em;
      if (novo === 'entregue') campos.entregue_em = em;
      // .eq('status', atual.status): se outro aparelho mudou antes, não sobrescreve.
      const linhas = ok(await sb.from('pedidos').update(campos).eq('id', id).eq('status', atual.status).select());
      return linhas[0] || obterPedido(id);
    },

    async listarAssinaturas() {
      return ok(await sb.from('assinaturas').select('*').order('criado_em', { ascending: false }).limit(300));
    },
    async criarAssinatura(dados) {
      return ok(await sb.from('assinaturas').insert({ ...dados, status: 'ativa' }).select().single());
    },
    async atualizarAssinatura(id, campos) {
      return ok(await sb.from('assinaturas').update(campos).eq('id', id).select().single());
    },

    async zerar() {
      ok(await sb.rpc('zerar_demo'));
      await canal.send({ type: 'broadcast', event: 'reset', payload: {} });
      avisar({ tabela: '*', tipo: 'reset' });
    },

    // Diferença entre a hora do servidor e a deste aparelho, pela menor de três idas e voltas.
    async diferencaRelogio() {
      let melhor = null;
      for (let i = 0; i < 3; i++) {
        const t0 = Date.now();
        const servidor = new Date(ok(await sb.rpc('agora'))).getTime();
        const t1 = Date.now();
        if (!melhor || t1 - t0 < melhor.ida) melhor = { ida: t1 - t0, dif: servidor - (t0 + t1) / 2 };
      }
      return melhor.dif;
    },

    ouvir(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },
  };
}
