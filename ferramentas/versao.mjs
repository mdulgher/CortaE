// Troca a versão da demo e põe "?v=<versão>" em todo arquivo próprio que as páginas carregam.
// Por quê: o GitHub Pages deixa cada arquivo 10 min no cache do navegador. Sem isso, depois de publicar,
// o Safari pode juntar um cliente.js novo com um catalogo.js velho, e o app nem desenha a tela.
// Uso: node ferramentas/versao.mjs 0.3.1   (rodar antes de cada commit que vai ser publicado)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const v = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(v || '')) { console.error('Uso: node ferramentas/versao.mjs 0.3.1'); process.exit(1); }
const raiz = resolve(fileURLToPath(new URL('..', import.meta.url)));
const trocar = (arq, fn) => {
  const antes = readFileSync(arq, 'utf8');
  const depois = fn(antes);
  if (depois !== antes) { writeFileSync(arq, depois); console.log('atualizado', arq.slice(raiz.length + 1)); }
};

// Imports entre os módulos (estáticos e dinâmicos): todos com a mesma versão, para não haver duas cópias do mesmo módulo.
for (const f of readdirSync(join(raiz, 'js')).filter((n) => n.endsWith('.js'))) {
  trocar(join(raiz, 'js', f), (s) => s
    .replace(/(['"])(\.\/[\w-]+\.js)(\?v=[\w.]*)?\1/g, `$1$2?v=${v}$1`)
    .replace(/RELEASE: '[^']*'/, `RELEASE: '${v}'`));
}
// Scripts e folhas de estilo das páginas.
for (const f of readdirSync(raiz).filter((n) => n.endsWith('.html'))) {
  trocar(join(raiz, f), (s) => s.replace(/((?:src|href)=")((?:js|css)\/[\w-]+\.(?:js|css))(\?v=[\w.]*)?"/g, `$1$2?v=${v}"`));
}
console.log(`versão ${v}`);
