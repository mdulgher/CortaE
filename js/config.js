// Configuração do CortaÊ (demo do TCC).
// Para usar o Supabase (celular, açougue e TV vendo o mesmo pedido em aparelhos diferentes),
// preencha SUPABASE_URL e SUPABASE_KEY (a chave "publishable"/"anon", que é pública por natureza).
// Nunca coloque aqui a chave "service_role".
export const CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_KEY: '',
  ENTREGA_SEGUNDOS: 30,   // quanto tempo o motoboy leva no mapa
  RELEASE: '0.1.0',
};

// ?fonte=local força o modo local (só funciona entre abas do mesmo navegador).
const forcada = new URLSearchParams(location.search).get('fonte');
export const DATA_SOURCE = forcada === 'local' ? 'local'
  : (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY ? 'supabase' : 'local');
