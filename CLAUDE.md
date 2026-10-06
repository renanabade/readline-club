# readline club

Plataforma do clube de leitura readline.club: React (`src/`), API Hono em Cloudflare Pages Functions (`worker/`, `functions/`), D1 (`migrations/`), contratos e validação compartilhados (`shared/`).

Antes de qualquer mudança, siga a documentação interna:

- `docs/entrega.md` — escopo, branch, Conventional Commits em português, PR com contexto/análise/validação, squash merge, deploy.
- `docs/arquitetura.md` — onde cada coisa fica, padrões de backend e frontend, valores da instância, migrations.
- `docs/testes.md` — o que cada tipo de mudança precisa testar e como.
- `docs/seguranca-privacidade.md` — checklist obrigatório; o repositório é público.
- `docs/operacao.md` — ambiente local, conta administrativa, e-mails e deploy.

O `README.md` é só explicativo, para o público (o que é a plataforma e como os dados são tratados); instruções operacionais ficam em `docs/`.

Regras que não podem ser quebradas:

- Toda entrega em branch própria e PR; nunca commit direto na `main`. Commit e push só quando pedido.
- Nada da instância ou de pessoas reais fixo no código (domínios, e-mails, convites, datas, nomes). Testes usam `example.test`.
- Migration aplicada nunca é editada; migration nova entra em `tests/helpers.ts`.
- Antes de declarar pronto: `npm run verify`, `npm run build:pages`, `npx prettier --check .` (e `npm run build:mailer` se o mailer mudou), com o resultado relatado.
- Código, nomes e comentários em inglês; interface, mensagens da API, documentação, commits e PRs em português.
