// Implementação Supabase: mesma interface do db-local.js, com tempo real entre aparelhos.
// Schema em supabase/schema.sql. Sem login: a demo usa a chave pública e tabelas abertas (decisão do dono).

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export async function criar(CONFIG) {
  const { createClient } = await import(SUPABASE_JS);
  const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ouvintes = new Set();
  const avisar = (msg) => ouvintes.forEach((fn) => { try { fn(msg); } catch (e) { console.error(e); } });

  const canal = sb.channel('cortae-demo');
  for (const tabela of ['pedidos', 'assinaturas']) {
    canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, (pl) => {
      avisar({ tabela, tipo: String(pl.eventType).toLowerCase(), registro: pl.new });
    });
  }
  canal.on('broadcast', { event: 'reset' }, () => avisar({ tabela: '*', tipo: 'reset' }));
  canal.subscribe();

  const ok = ({ data, error }) => { if (error) throw error; return data; };
  const obterPedido = async (id) => ok(await sb.from('pedidos').select('*').eq('id', id).maybeSingle());

  return {
    fonte: 'supabase',

    async listarPedidos() {
      return ok(await sb.from('pedidos').select('*').order('criado_em', { ascending: false }).limit(300));
    },
    obterPedido,

    async criarPedido(dados) {
      const em = new Date().toISOString();
      const linha = { ...dados, status: 'recebido', historico: [{ status: 'recebido', em }] };
      return ok(await sb.from('pedidos').insert(linha).select().single());
    },

    async mudarStatus(id, novo, deStatus) {
      const atual = await obterPedido(id);
      if (!atual) return null;
      if (deStatus && atual.status !== deStatus) return atual;
      if (atual.status === novo) return atual;
      const em = new Date().toISOString();
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

    ouvir(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },
  };
}
