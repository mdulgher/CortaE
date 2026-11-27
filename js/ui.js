// Utilitários de tela compartilhados pelas três páginas.
import { ic } from './icones.js?v=0.3.1';
import { agora } from './relogio.js?v=0.3.1';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const dinheiro = (v) => fmtMoeda.format(Number(v) || 0);

export const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
export const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '');

export function tempoDesde(iso) {
  const s = Math.max(0, Math.round((agora() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `há ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  return `há ${Math.round(m / 60)} h`;
}

// ---------- Tema claro/escuro: segue o sistema; o botão grava a escolha ----------
const CHAVE_TEMA = 'cortae.tema';
function temaSalvo() { try { return localStorage.getItem(CHAVE_TEMA); } catch { return null; } }
export function temaAtual() {
  return document.documentElement.dataset.theme
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
export function iniciarTema() {
  const t = temaSalvo();
  if (t) document.documentElement.dataset.theme = t;
  atualizarBotoesTema();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', atualizarBotoesTema);
}
export function alternarTema() {
  const novo = temaAtual() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = novo;
  try { localStorage.setItem(CHAVE_TEMA, novo); } catch { /* sem armazenamento: só nesta visita */ }
  atualizarBotoesTema();
  document.dispatchEvent(new CustomEvent('tema'));
}
export function atualizarBotoesTema() {
  document.querySelectorAll('[data-tema-btn]').forEach((b) => {
    const escuro = temaAtual() === 'dark';
    b.innerHTML = ic(escuro ? 'sol' : 'lua');
    b.title = escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro';
    b.setAttribute('aria-label', b.title);
  });
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-tema-btn]')) alternarTema();
});

// ---------- Toast ----------
export function toast(texto, tipo = '') {
  let caixa = document.querySelector('.toasts');
  if (!caixa) {
    caixa = document.createElement('div');
    caixa.className = 'toasts';
    document.body.appendChild(caixa);
  }
  if (!caixa.hasAttribute('role')) { caixa.setAttribute('role', 'status'); caixa.setAttribute('aria-live', 'polite'); }
  const t = document.createElement('div');
  t.className = `toast ${tipo}`;
  t.textContent = texto;
  caixa.appendChild(t);
  setTimeout(() => t.classList.add('sai'), 3200);
  setTimeout(() => t.remove(), 3700);
}

// ---------- Modal de confirmação (sem confirm() do navegador) ----------
export function confirmar({ titulo, texto = '', ok = 'Confirmar', cancelar = 'Cancelar', perigo = false }) {
  return new Promise((resolve) => {
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <h3 id="modal-titulo">${esc(titulo)}</h3>
        ${texto ? `<p>${esc(texto)}</p>` : ''}
        <div class="modal-acoes">
          <button class="btn btn-sec" data-r="0">${esc(cancelar)}</button>
          <button class="btn ${perigo ? 'btn-perigo' : 'btn-pri'}" data-r="1">${esc(ok)}</button>
        </div>
      </div>`;
    const antes = document.activeElement;
    const tecla = (e) => { if (e.key === 'Escape') fechar(false); };
    const fechar = (r) => {
      fundo.remove();
      document.removeEventListener('keydown', tecla);
      antes?.focus?.({ preventScroll: true });
      resolve(r);
    };
    document.addEventListener('keydown', tecla);
    fundo.addEventListener('click', (e) => {
      if (e.target === fundo) return fechar(false);
      const b = e.target.closest('[data-r]');
      if (b) fechar(b.dataset.r === '1');
    });
    document.body.appendChild(fundo);
    fundo.querySelector('[data-r="1"]').focus();
  });
}

// ---------- Tela acesa (TV, painel e celular não apagam no meio da apresentação) ----------
// O navegador só concede depois de um toque; ao voltar para a aba, a trava cai e é pedida de novo.
let trava = null;
async function pedirTrava() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || (trava && !trava.released)) return;
  try { trava = await navigator.wakeLock.request('screen'); } catch { trava = null; }
}
export function manterTelaAcesa() {
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, pedirTrava, { passive: true }));
  document.addEventListener('visibilitychange', pedirTrava);
}

// ---------- Som de aviso (WebAudio; precisa de um toque do usuário para liberar) ----------
let audio;
export async function liberarSom() {
  audio = audio || new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') { try { await audio.resume(); } catch { /* sem saída de áudio */ } }
  return audio;
}
export function somLiberado() { return !!audio && audio.state === 'running'; }
export function tocarAviso() {
  if (!somLiberado()) return;
  const notas = [880, 1175, 1568];
  notas.forEach((f, i) => {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    const t0 = audio.currentTime + i * 0.16;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    o.connect(g).connect(audio.destination);
    o.start(t0);
    o.stop(t0 + 0.3);
  });
}

// ---------- Erros: aparecem na tela em vez de sumir no console ----------
export function vigiarErros() {
  const mostrar = (msg) => toast(`Erro: ${msg}`, 'erro');
  window.addEventListener('error', (e) => mostrar(e.message));
  window.addEventListener('unhandledrejection', (e) => mostrar(e.reason?.message || String(e.reason)));
}
