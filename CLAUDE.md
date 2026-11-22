# CortaÊ — contrato curto para a IA

- **O que é:** demo do TCC da Karla, descartada depois da apresentação (~2026-12-05). Página web responsiva aberta no
  Safari do celular, mais o painel do açougue e o monitor da TV. Não é app de loja nem produto.
- **Decisões do dono e histórico:** nota central no cofre, `05 - Projetos Pessoais (Aplicações)/05.09 - CortaE/CortaE.md`
  (vault "IA Memory Vault"). Ler antes de mudar algo de produto.
- **Sem cuidados de produção** por decisão do dono: sem login, sem DEV/PRD, tabelas abertas para a chave pública.
  Mesmo assim: nunca a chave `service_role` em arquivo, nenhum dado real de pessoa.
- **Stack:** HTML, CSS e JS puros, sem build e sem dependência instalada. Bibliotecas só por CDN com versão fixa.
- **Regra de dados:** as telas só falam com `js/db.js`. Toda função nova entra nas duas implementações
  (`db-local.js` e `db-supabase.js`) com a mesma assinatura.
- **Testar:** `node ferramentas/servidor.mjs` e as três telas em abas do mesmo navegador (modo local); no celular, pelo Supabase.
- **A pasta fica no iCloud** (`C:\Users\User\iCloudDrive\CortaE_`) porque é compartilhada. Não mover.
- **Repositório:** GitHub **público** `mdulgher/CortaE`, branch `main`, publicado pelo GitHub Pages em https://mdulgher.github.io/CortaE/ a cada push. Commits com o e-mail `noreply` do GitHub (nunca o pessoal). Commit com o porquê. Push só com ordem do Marcos.
- **Fora de uso, site e banco ficam desligados** (Pages despublicado, Supabase pausado), por decisão do Marcos em 2026-11-21. Religar só a pedido dele e desligar no fim; passos no README, seção "Desligado fora de uso".
- Responder em português do Brasil.
