// Servidor local para testar o CortaÊ no computador (sem instalar nada além do Node).
// Uso:  node ferramentas/servidor.mjs [porta]     → http://localhost:5173
// Os módulos JavaScript não funcionam abrindo o index.html direto pelo arquivo; por isso o servidor.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(fileURLToPath(new URL('..', import.meta.url)));
const porta = Number(process.argv[2]) || 5173;
const tipos = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};
// Só o que o site publica; documentação, ferramentas e pastas ocultas respondem 404.
const permitido = (rel) => /^(index\.html|acougue\.html|monitor\.html|(css|js|img)\/[\w.-]+)$/.test(rel);

createServer(async (req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  rel = normalize(rel).replace(/\\/g, '/');
  const arquivo = join(raiz, rel);
  try {
    if (!permitido(rel) || !arquivo.startsWith(raiz) || !(await stat(arquivo)).isFile()) throw new Error('404');
    res.writeHead(200, { 'Content-Type': tipos[extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(arquivo));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Não encontrado');
  }
}).listen(porta, () => console.log(`CortaÊ em http://localhost:${porta}`));
