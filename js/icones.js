// Ícones de traço (24×24, cor = currentColor). Uso: ic('casa') devolve o <svg>;
// em HTML estático, <span data-ic="casa"></span> e pintarIcones().

const P = {
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  lua: '<path d="M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z"/>',
  sino: '<path d="M6 10a6 6 0 0 1 12 0c0 4.5 1.8 6 1.8 6H4.2S6 14.5 6 10z"/><path d="M10 19.5a2 2 0 0 0 4 0"/>',
  carrinho: '<path d="M3 4h2.2l2.1 10a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.5-1.1L20.5 8H6.1"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  busca: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  pino: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  voltar: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  casa: '<path d="M4 11l8-6.5 8 6.5v8a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z"/>',
  grade: '<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>',
  ciclo: '<path d="M19.5 12a7.5 7.5 0 0 1-13.4 4.6M4.5 12a7.5 7.5 0 0 1 13.4-4.6"/><path d="M18.3 3.8v3.9h-3.9M5.7 20.2v-3.9h3.9"/>',
  recibo: '<path d="M6 3.5h12V20l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  pessoa: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  caixa: '<path d="M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M3.5 7.5L12 11.5l8.5-4M12 11.5v9"/>',
  cesta: '<path d="M4 10h16l-1.6 8.4a1.6 1.6 0 0 1-1.6 1.3H7.2a1.6 1.6 0 0 1-1.6-1.3z"/><path d="M8 10l3-6M16 10l-3-6M9.5 13.5v3M14.5 13.5v3"/>',
  carne: '<path d="M7.6 6.3c3.1-2.4 9-2.3 11.4 1.6 2.2 3.6.2 8.5-4.3 9.5-2.4.5-4 1.9-6.7 1.9-3.3 0-5-2.8-4.3-5.6.6-2.3 1.6-5.6 3.9-7.4z"/><circle cx="14.3" cy="11" r="2"/>',
  mais: '<path d="M12 5.5v13M5.5 12h13"/>',
  menos: '<path d="M5.5 12h13"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  telacheia: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  reiniciar: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>',
  moto: '<circle cx="6" cy="17" r="2.6"/><circle cx="18" cy="17" r="2.6"/><path d="M8.6 17h6.8M13 8h3l2 9M9 12h5l1.5-4M5 12h4"/>',
  relogio: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  estrela: '<path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4 7.2 18.9l.9-5.4-3.9-3.8 5.4-.8z"/>',
  sair: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H4"/>',
};

export function ic(nome, classe = '') {
  return `<svg class="ic ${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nome] || ''}</svg>`;
}

export function pintarIcones(raiz = document) {
  raiz.querySelectorAll('[data-ic]').forEach((el) => { el.innerHTML = ic(el.dataset.ic); });
}
