// Implementação Supabase: mesma interface do db-local.js, com tempo real entre aparelhos.
// Schema em supabase/schema.sql. Sem login: a demo usa a chave pública e tabelas abertas (decisão do dono).
import { agoraISO } from './relogio.js?v=0.3.1';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
// Rede de segurança: recarrega a cada 5 s enquanto a tela está visível. Se o tempo real cair sem avisar
// (Wi-Fi do auditório), a entrega de 30 s não fica parada; as telas só redesenham se algo mudou.
const SYNC_MS = 5000;

export async function criar(CONFIG) {
  const { createClient } = await import(SUPABASE_JS);
  const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ouvintes = new Set();
  // Rajadas viram um aviso só: zerar a demo apaga N linhas e gera N eventos no mesmo instante.
  // Na rajada vale o aviso mais forte: reset, depois mudança, depois recarga de segurança.
  const PESO = { sync: 0, reset: 2 };
  let pendente = null;
  let timer = null;
  const avisar = (msg) => {
    if (!pendente || (PESO[msg.tipo] ?? 1) >= (PESO[pendente.tipo] ?? 1)) pendente = msg;
    if (timer) return;
    timer = setTimeout(() => {
      const m = pendente;
      pendente = null;
      timer = null;
      ouvintes.forEach((fn) => { try { fn(m); } catch (e) { console.error(e); } });
    }, 80);
  };
  const sincronizar = () => avisar({ tabela: '*', tipo: 'sync' });

  const canal = sb.channel('cortae-demo');
  for (const tabela of ['pedidos', 'assinaturas', 'esgotados', 'parceiros']) {
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
      const p = ok(await sb.from('pedidos').insert(linha).select().single());
      avisar({ tabela: 'pedidos', tipo: 'insert', registro: p }); // esta tela não depende do eco do tempo real
      return p;
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
      if (!linhas[0]) return obterPedido(id);
      avisar({ tabela: 'pedidos', tipo: 'update', registro: linhas[0] });
      return linhas[0];
    },

    async atualizarExtras(id, campos) {
      const atual = await obterPedido(id);
      if (!atual) return null;
      const p = ok(await sb.from('pedidos').update({ extras: { ...(atual.extras || {}), ...campos } }).eq('id', id).select().single());
      avisar({ tabela: 'pedidos', tipo: 'update', registro: p });
      return p;
    },

    async listarAssinaturas() {
      return ok(await sb.from('assinaturas').select('*').order('criado_em', { ascending: false }).limit(300));
    },
    async criarAssinatura(dados) {
      const a = ok(await sb.from('assinaturas').insert({ ...dados, status: 'ativa' }).select().single());
      avisar({ tabela: 'assinaturas', tipo: 'insert', registro: a });
      return a;
    },
    async atualizarAssinatura(id, campos) {
      const a = ok(await sb.from('assinaturas').update(campos).eq('id', id).select().single());
      avisar({ tabela: 'assinaturas', tipo: 'update', registro: a });
      return a;
    },

    async listarEsgotados() {
      return ok(await sb.from('esgotados').select('*'));
    },
    async marcarEsgotado(produtoId, acougueId, esgotado) {
      if (esgotado) ok(await sb.from('esgotados').upsert({ produto_id: produtoId, acougue_id: acougueId }));
      else ok(await sb.from('esgotados').delete().eq('produto_id', produtoId));
      avisar({ tabela: 'esgotados', tipo: 'update' });
    },

    async listarParceiros() {
      return ok(await sb.from('parceiros').select('*').order('criado_em', { ascending: false }).limit(100));
    },
    async criarParceiro(dados) {
      const c = ok(await sb.from('parceiros').insert({ etapa: 1, status: 'cadastro', ...dados }).select().single());
      avisar({ tabela: 'parceiros', tipo: 'insert', registro: c });
      return c;
    },
    async atualizarParceiro(id, campos) {
      const c = ok(await sb.from('parceiros').update(campos).eq('id', id).select().single());
      avisar({ tabela: 'parceiros', tipo: 'update', registro: c });
      return c;
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
