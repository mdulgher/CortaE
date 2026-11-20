// Configuração do CortaÊ (demo do TCC).
// Para usar o Supabase (celular, açougue e TV vendo o mesmo pedido em aparelhos diferentes),
// preencha SUPABASE_URL e SUPABASE_KEY (a chave "publishable"/"anon", que é pública por natureza).
// Nunca coloque aqui a chave "service_role".
export const CONFIG = {
  SUPABASE_URL: 'https://ddxjcmyezcnrvsptyfhn.supabase.co',
  // Chave "anon" (pública por natureza; as regras do banco é que decidem o que ela pode).
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeGpjbXllemNucnZzcHR5ZmhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxNzczMDksImV4cCI6MjExMDc1MzMwOX0.M2uv8nMBLzQDcZM0rJEi8z_C8coWw-FEPh5uDqGHm2s',
  ENTREGA_SEGUNDOS: 30,   // quanto tempo o motoboy leva no mapa
  RELEASE: '0.1.0',
};

// ?fonte=local força o modo local (só funciona entre abas do mesmo navegador).
const forcada = new URLSearchParams(location.search).get('fonte');
export const DATA_SOURCE = forcada === 'local' ? 'local'
  : (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY ? 'supabase' : 'local');
