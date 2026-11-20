// Simulação da entrega: o motoboy percorre a rota do açougue até o cliente em CONFIG.ENTREGA_SEGUNDOS.
// Qualquer tela aberta (cliente, açougue ou TV) marca "entregue" quando o tempo acaba.
import { CONFIG } from './config.js';
import { ACOUGUES, CLIENTE_PADRAO, acougue } from './catalogo.js';

export function progressoEntrega(p) {
  if (p.status === 'entregue') return 1;
  if (p.status !== 'saiu' || !p.saiu_em) return 0;
  const s = (Date.now() - new Date(p.saiu_em).getTime()) / 1000;
  return Math.min(1, Math.max(0, s / CONFIG.ENTREGA_SEGUNDOS));
}

export function segundosRestantes(p) {
  return Math.max(0, Math.ceil(CONFIG.ENTREGA_SEGUNDOS * (1 - progressoEntrega(p))));
}

// Ponto na rota (lista de [lat, lng]) para t entre 0 e 1, proporcional à distância.
export function pontoNaRota(rota, t) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < rota.length; i++) {
    const d = Math.hypot(rota[i][0] - rota[i - 1][0], rota[i][1] - rota[i - 1][1]);
    seg.push(d);
    total += d;
  }
  let alvo = total * t;
  for (let i = 0; i < seg.length; i++) {
    if (alvo <= seg[i] || i === seg.length - 1) {
      const f = seg[i] ? Math.min(1, alvo / seg[i]) : 1;
      return [rota[i][0] + (rota[i + 1][0] - rota[i][0]) * f, rota[i][1] + (rota[i + 1][1] - rota[i][1]) * f];
    }
    alvo -= seg[i];
  }
  return rota[rota.length - 1];
}

const tentados = new Set();
export async function concluirEntregasVencidas(api, pedidos) {
  for (const p of pedidos) {
    if (p.status === 'saiu' && progressoEntrega(p) >= 1 && !tentados.has(p.id)) {
      tentados.add(p.id);
      try { await api.mudarStatus(p.id, 'entregue', 'saiu'); } catch (e) { tentados.delete(p.id); throw e; }
    }
  }
}

// ---------- Mapa (Leaflet global, carregado por <script> na página) ----------
const icone = (emoji, classe = '') => L.divIcon({
  className: `pino ${classe}`, html: `<span>${emoji}</span>`, iconSize: [40, 40], iconAnchor: [20, 20],
});

export class MapaEntrega {
  constructor(el, { todosAcougues = false, zoomControl = true } = {}) {
    this.mapa = L.map(el, { zoomControl, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(this.mapa);
    this.casa = L.marker(CLIENTE_PADRAO.pos, { icon: icone('🏠', 'pino-casa') }).addTo(this.mapa);
    this.lojas = {};
    if (todosAcougues) {
      ACOUGUES.forEach((a) => {
        this.lojas[a.id] = L.marker(a.pos, { icon: icone(a.icone, 'pino-loja') }).addTo(this.mapa).bindTooltip(a.nome);
      });
    }
    this.linha = null;
    this.moto = null;
    this.pedidoId = null;
    this.enquadrar(ACOUGUES.map((a) => a.pos).concat([CLIENTE_PADRAO.pos]));
  }

  enquadrar(pontos) {
    this.mapa.fitBounds(L.latLngBounds(pontos), { padding: [40, 40] });
  }

  mostrar(p) {
    const a = p && acougue(p.acougue_id);
    if (!a) {
      this.limparRota();
      this.pedidoId = null;
      return;
    }
    if (this.pedidoId !== p.id) {
      this.limparRota();
      this.pedidoId = p.id;
      if (!this.lojas[a.id]) this.lojas[a.id] = L.marker(a.pos, { icon: icone(a.icone, 'pino-loja') }).addTo(this.mapa);
      this.linha = L.polyline(a.rota, { color: '#8a1414', weight: 5, opacity: 0.7, dashArray: '2 10', lineCap: 'round' }).addTo(this.mapa);
      this.enquadrar(a.rota);
    }
    const t = progressoEntrega(p);
    if (p.status === 'saiu' || p.status === 'entregue') {
      const pos = pontoNaRota(a.rota, t);
      if (!this.moto) this.moto = L.marker(pos, { icon: icone('🛵', 'pino-moto'), zIndexOffset: 1000 }).addTo(this.mapa);
      else this.moto.setLatLng(pos);
    } else if (this.moto) {
      this.moto.remove();
      this.moto = null;
    }
  }

  limparRota() {
    this.linha?.remove();
    this.moto?.remove();
    this.linha = null;
    this.moto = null;
  }

  ajustar() { this.mapa.invalidateSize(); }
}
