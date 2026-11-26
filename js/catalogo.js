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
    razao: 'Prime Carnes Nobres Ltda.', cnpj: '12.345.678/0001-90', plano: 'entrega', avaliacoes: 128,
    licenca: 'CEVS 354850-001/2026', inspecao: 'SIF 1234 · frigorífico de origem',
    docs: { alvara: 210, licenca: 95, origem: 300, boaspraticas: 160 },
    desc: 'Cortes premium e dry aged, direto do produtor.',
    rota: [[-23.9668, -46.3330], [-23.9690, -46.3318], [-23.9712, -46.3300], [-23.9718, -46.3270], [-23.9705, -46.3245]],
  },
  {
    id: 'casa', nome: 'Casa da Carne', icone: '🐂', bairro: 'Vila Mathias',
    endereco: 'Av. Conselheiro Nébias, 120 — Vila Mathias', pos: [-23.9457, -46.3268],
    nota: 4.8, tempo: '30–40 min', taxa: 4.9, fator: 1.0,
    razao: 'Casa da Carne Vila Mathias Comércio de Carnes Ltda.', cnpj: '23.456.789/0001-01', plano: 'entrega', avaliacoes: 342,
    licenca: 'CEVS 354850-002/2026', inspecao: 'SISP 0456 · frigorífico de origem',
    docs: { alvara: 140, licenca: 180, origem: 250, boaspraticas: 75 },
    desc: 'Tradição de bairro, preço justo todo dia.',
    rota: [[-23.9457, -46.3268], [-23.9500, -46.3262], [-23.9560, -46.3255], [-23.9620, -46.3250], [-23.9670, -46.3247], [-23.9705, -46.3245]],
  },
  {
    id: 'boi', nome: 'Boi Nobre', icone: '🐄', bairro: 'Ponta da Praia',
    endereco: 'Av. Almirante Saldanha da Gama, 30 — Ponta da Praia', pos: [-23.9847, -46.3006],
    nota: 4.7, tempo: '35–45 min', taxa: 7.9, fator: 1.08,
    razao: 'Boi Nobre Açougue e Churrascaria Ltda.', cnpj: '34.567.890/0001-12', plano: 'entrega', avaliacoes: 96,
    licenca: 'CEVS 354850-003/2026', inspecao: 'SIM 078 Santos · frigorífico de origem',
    docs: { alvara: 320, licenca: 12, origem: 190, boaspraticas: 230 },
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

export const BASE = [
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

// ---------- Plano de negócio da Karla (PDF "CORTAE_plano_de_negocio_blueprint v1") ----------
// Dados da empresa: fictícios, só para a demonstração (o Decreto 7.962/2013 pede a identificação de quem vende).
export const EMPRESA = {
  nome: 'CortaÊ', razao: 'CortaÊ Tecnologia Ltda. (fictícia)', cnpj: '45.678.901/0001-23',
  sede: 'Santos (SP)', slogan: 'Escolha. Peça. Receba!',
  missao: 'Levar carne de qualidade dos açougues da cidade até a mesa das pessoas, com praticidade e confiança.',
  visao: 'Ser a principal plataforma de carnes da Baixada Santista e expandir para outras cidades.',
  valores: ['Qualidade', 'Confiança', 'Praticidade', 'Parceria com o comércio local'],
};

// Planos para o açougue. Referência: os dois planos do iFood citados no PDF; valores finais a definir pelo grupo.
export const PLANOS_PARCEIRO = [
  { id: 'basico', nome: 'Básico', comissao: 0.12, pagOnline: 0.032, mensalidade: 110, entrega: 'O próprio açougue entrega' },
  { id: 'entrega', nome: 'Entrega', comissao: 0.23, pagOnline: 0.032, mensalidade: 150, entrega: 'Entregadores CortaÊ' },
];
export const planoParceiro = (id) => PLANOS_PARCEIRO.find((p) => p.id === id) || PLANOS_PARCEIRO[1];

// O que o açougue precisa para ser parceiro (item 4.2 do PDF).
export const REQUISITOS = [
  { id: 'cnpj', nome: 'CNPJ ativo', desc: 'Comércio varejista de carnes (CNAE 4722-9/01, açougues)', quem: 'Receita Federal' },
  { id: 'alvara', nome: 'Alvará de funcionamento', desc: 'Autoriza o estabelecimento a funcionar no endereço', quem: 'Prefeitura de Santos' },
  { id: 'licenca', nome: 'Licença sanitária (SIVISA / CEVS)', desc: 'Licença de funcionamento da vigilância sanitária', quem: 'Vigilância Sanitária de Santos (SEVISA)' },
  { id: 'origem', nome: 'Carne de origem inspecionada', desc: 'Toda carne comprada de frigorífico com selo SIF, SISP ou SIM', quem: 'MAPA, estado ou município' },
  { id: 'boaspraticas', nome: 'Boas práticas', desc: 'Manual de boas práticas e controle de temperatura (RDC ANVISA 216/2004 e Portaria CVS 3/2026)', quem: 'Vigilância sanitária' },
  { id: 'banco', nome: 'Conta bancária no CNPJ', desc: 'Necessária para o repasse das vendas', quem: 'Banco do açougue' },
];

// Temperaturas exigidas dos parceiros (Portaria CVS 3/2026, que substituiu a CVS 5/2013 em outubro de 2026).
export const TEMPERATURAS = [
  ['Recebimento de carnes', 'entre 4 e 7 °C · congelados a -12 °C ou menos'],
  ['Armazenamento (bovina, suína e aves)', 'no máximo 4 °C, por até 3 dias'],
  ['Carne temperada e moída', 'no máximo 4 °C, por até 2 dias'],
  ['Congelados', 'abaixo de -18 °C, por até 90 dias'],
  ['Transporte', 'compartimento fechado, pré-resfriado e com termômetro calibrado'],
  ['Entrega CortaÊ (padrão próprio)', 'embalagem térmica lacrada e tempo máximo de entrega'],
];

// Etapas do cadastro do parceiro (blueprint 4.1).
export const ETAPAS_PARCEIRO = [
  { n: 1, nome: 'Conhecer e se inscrever', desc: 'Cadastro online com CNPJ e endereço' },
  { n: 2, nome: 'Enviar documentos', desc: 'Alvará, licença sanitária, origem da carne e conta bancária' },
  { n: 3, nome: 'Validação', desc: 'O CortaÊ confere CNPJ, licença e origem SIF/SISP/SIM' },
  { n: 4, nome: 'Contrato e treinamento', desc: 'Escolhe o plano; treino de painel, embalagem e lacre' },
  { n: 5, nome: 'Montar a vitrine', desc: 'Cortes, kits, preços e horários' },
  { n: 6, nome: 'Vender e renovar', desc: 'Aceita pedidos e mantém as licenças em dia' },
];

// Nota do açougue: a base fictícia mais as avaliações feitas na demonstração.
export function notaAcougue(a, pedidos = []) {
  const novas = pedidos.filter((p) => p.acougue_id === a.id && p.extras?.avaliacao).map((p) => p.extras.avaliacao.acougue);
  const total = a.nota * a.avaliacoes + novas.reduce((s, n) => s + n, 0);
  const qtd = a.avaliacoes + novas.length;
  return { nota: total / qtd, qtd };
}

// Temperatura medida na entrega (simulada, estável por pedido): sempre dentro da regra (até 4 °C).
export function temperaturaEntrega(p) {
  const h = [...String(p.id)].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) % 1000, 7);
  return (2.4 + (h % 15) / 10).toFixed(1).replace('.', ',');
}

// Substituto de um corte esgotado: mesma categoria e mesmo açougue; senão o mesmo corte em outro açougue.
export function substituto(id, esgotados) {
  const p = produto(id);
  if (!p) return null;
  const livre = (x) => x.id !== id && !esgotados.has(x.id);
  return PRODUTOS.find((x) => livre(x) && x.acougue === p.acougue && x.cat === p.cat)
    || PRODUTOS.find((x) => livre(x) && x.nome === p.nome)
    || null;
}
