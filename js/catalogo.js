// Catálogo fictício da demo. Fica no código (não no banco): só pedidos e assinaturas são compartilhados.

export const CLIENTE_PADRAO = {
  endereco: 'Av. Conselheiro Nébias, 500 — Boqueirão, Santos - SP',
  pos: [-23.9705, -46.3245],
};

export const ACOUGUES = [
  {
    id: 'prime', nome: 'Açougue Prime', icone: '🔪', bairro: 'Gonzaga',
    endereco: 'Rua Marechal Deodoro, 80 — Gonzaga', pos: [-23.9668, -46.3330],
    nota: 4.9, tempo: '25–35 min', taxa: 6.9, fator: 1.15,
    desc: 'Cortes premium e dry aged, direto do produtor.',
    rota: [[-23.9668, -46.3330], [-23.9690, -46.3318], [-23.9712, -46.3300], [-23.9718, -46.3270], [-23.9705, -46.3245]],
  },
  {
    id: 'casa', nome: 'Casa da Carne', icone: '🐂', bairro: 'Vila Mathias',
    endereco: 'Av. Conselheiro Nébias, 120 — Vila Mathias', pos: [-23.9457, -46.3268],
    nota: 4.8, tempo: '30–40 min', taxa: 4.9, fator: 1.0,
    desc: 'Tradição de bairro, preço justo todo dia.',
    rota: [[-23.9457, -46.3268], [-23.9500, -46.3262], [-23.9560, -46.3255], [-23.9620, -46.3250], [-23.9670, -46.3247], [-23.9705, -46.3245]],
  },
  {
    id: 'boi', nome: 'Boi Nobre', icone: '🐄', bairro: 'Ponta da Praia',
    endereco: 'Av. Almirante Saldanha da Gama, 30 — Ponta da Praia', pos: [-23.9847, -46.3006],
    nota: 4.7, tempo: '35–45 min', taxa: 7.9, fator: 1.08,
    desc: 'Especialista em churrasco e kits para a família.',
    rota: [[-23.9847, -46.3006], [-23.9810, -46.3060], [-23.9775, -46.3120], [-23.9745, -46.3180], [-23.9725, -46.3220], [-23.9705, -46.3245]],
  },
];

export const CATEGORIAS = [
  { id: 'bovinos', nome: 'Bovinos', icone: '🥩' },
  { id: 'suinos', nome: 'Suínos', icone: '🍖' },
  { id: 'aves', nome: 'Aves', icone: '🍗' },
  { id: 'linguicas', nome: 'Linguiças', icone: '🌭' },
  { id: 'kits', nome: 'Kits', icone: '📦' },
  { id: 'outros', nome: 'Outros Produtos', icone: '🧺' },
];

const BASE = [
  { b: 'picanha', nome: 'Picanha', cat: 'bovinos', peso: 'Peça de 1,2 kg', preco: 109.9, destaque: true },
  { b: 'alcatra', nome: 'Alcatra', cat: 'bovinos', peso: 'Bandeja de 1 kg', preco: 54.9 },
  { b: 'fraldinha', nome: 'Fraldinha', cat: 'bovinos', peso: 'Peça de 1 kg', preco: 49.9 },
  { b: 'contrafile', nome: 'Contrafilé', cat: 'bovinos', peso: 'Bandeja de 1 kg', preco: 59.9 },
  { b: 'costela', nome: 'Costela bovina', cat: 'bovinos', peso: 'Peça de 1,5 kg', preco: 44.9 },
  { b: 'patinho', nome: 'Patinho moído', cat: 'bovinos', peso: 'Bandeja de 500 g', preco: 22.9 },
  { b: 'costelinha', nome: 'Costelinha suína', cat: 'suinos', peso: 'Bandeja de 1 kg', preco: 32.9 },
  { b: 'lombo', nome: 'Lombo suíno', cat: 'suinos', peso: 'Peça de 1 kg', preco: 29.9 },
  { b: 'coxa', nome: 'Coxa e sobrecoxa', cat: 'aves', peso: 'Bandeja de 1 kg', preco: 18.9 },
  { b: 'asa', nome: 'Asinha de frango', cat: 'aves', peso: 'Bandeja de 1 kg', preco: 21.9 },
  { b: 'toscana', nome: 'Linguiça toscana', cat: 'linguicas', peso: 'Pacote de 1 kg', preco: 26.9 },
  { b: 'cuiabana', nome: 'Linguiça cuiabana', cat: 'linguicas', peso: 'Pacote de 500 g', preco: 24.9 },
  { b: 'kit-churrasco', nome: 'Kit Churrasco', cat: 'kits', peso: '4 pessoas · picanha, fraldinha, linguiça e pão de alho', preco: 189.9, destaque: true },
  { b: 'kit-semana', nome: 'Kit Semana', cat: 'kits', peso: 'Família · 4 kg de cortes do dia a dia', preco: 159.9 },
  { b: 'kit-fit', nome: 'Kit Fit', cat: 'kits', peso: 'Patinho, frango e lombo · 3 kg', preco: 119.9 },
  { b: 'carvao', nome: 'Carvão vegetal', cat: 'outros', peso: 'Saco de 5 kg', preco: 29.9 },
  { b: 'sal', nome: 'Sal grosso', cat: 'outros', peso: 'Pacote de 1 kg', preco: 6.9 },
  { b: 'paodealho', nome: 'Pão de alho', cat: 'outros', peso: 'Pacote com 5', preco: 16.9 },
  { b: 'farofa', nome: 'Farofa pronta', cat: 'outros', peso: 'Pacote de 500 g', preco: 12.9 },
];

const arred = (v) => Math.floor(v) + 0.9; // preço sempre terminando em ,90

export const PRODUTOS = ACOUGUES.flatMap((a) => BASE.map((p) => ({
  id: `${a.id}-${p.b}`,
  acougue: a.id,
  nome: p.nome,
  cat: p.cat,
  peso: p.peso,
  destaque: !!p.destaque,
  preco: Number(arred(p.preco * a.fator).toFixed(2)),
  icone: CATEGORIAS.find((c) => c.id === p.cat).icone,
})));

export const PLANOS = [
  { id: 'essencial', nome: 'Essencial', preco: 149.9, desc: '2 kg de cortes do dia a dia', icone: '🥩' },
  { id: 'churrasco', nome: 'Churrasco', preco: 219.9, desc: 'Kit churrasco de 3 kg + carvão', icone: '🔥', destaque: true },
  { id: 'familia', nome: 'Família', preco: 299.9, desc: '5 kg variados: bovinos, aves e suínos', icone: '👨‍👩‍👧' },
];

export const FREQUENCIAS = [
  { id: 'semanal', nome: 'Semanal', dias: 7 },
  { id: 'quinzenal', nome: 'Quinzenal', dias: 14 },
  { id: 'mensal', nome: 'Mensal', dias: 30 },
];

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const STATUS = {
  recebido: { nome: 'Pedido recebido', curto: 'Novo', icone: '🧾' },
  preparando: { nome: 'Em preparo', curto: 'Em preparo', icone: '🔪' },
  saiu: { nome: 'Saiu para entrega', curto: 'Em entrega', icone: '🛵' },
  entregue: { nome: 'Entregue', curto: 'Entregue', icone: '✅' },
  recusado: { nome: 'Recusado pelo açougue', curto: 'Recusado', icone: '✖️' },
};
export const ETAPAS = ['recebido', 'preparando', 'saiu', 'entregue'];

export const acougue = (id) => ACOUGUES.find((a) => a.id === id);
export const produto = (id) => PRODUTOS.find((p) => p.id === id);
export const plano = (id) => PLANOS.find((p) => p.id === id);
export const frequencia = (id) => FREQUENCIAS.find((f) => f.id === id);
