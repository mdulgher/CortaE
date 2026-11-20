// Relógio comum aos aparelhos. Cada aparelho tem a própria hora, e alguns segundos de diferença entre o celular,
// o notebook do açougue e o da TV fariam o motoboy pular ou esperar no mapa. Por isso tudo o que mede tempo usa
// agora(): a hora deste aparelho corrigida pela diferença para o servidor (zero no modo local).
let diferenca = 0; // milissegundos a somar ao relógio deste aparelho

export const agora = () => Date.now() + diferenca;
export const agoraISO = () => new Date(agora()).toISOString();

export function ajustarRelogio(ms) {
  if (Number.isFinite(ms) && Math.abs(ms) < 12 * 3600e3) diferenca = Math.round(ms);
}
export const diferencaAtual = () => diferenca;
