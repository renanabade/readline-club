# Arquitetura e padrões

## Visão geral

```
navegador (React, src/)
   │  fetch /api/*  (cookie de sessão HttpOnly)
   ▼
Cloudflare Pages Functions (functions/) ──► app Hono (worker/index.ts)
                                                │
                                                ├─ D1 (migrations/)
                                                └─ service binding ──► mailer (worker/approval-mailer.ts)
                                                                        ├─ D1 (mesmo banco)
                                                                        ├─ Cloudflare Email Service
                                                                        └─ cron do resumo de pendências
```

| Pasta             | Conteúdo                                                                          |
| ----------------- | --------------------------------------------------------------------------------- |
| `src/pages/`      | Uma tela por arquivo, ligada a uma rota em `src/app.tsx`.                         |
| `src/components/` | Componentes reutilizáveis entre telas.                                            |
| `src/lib/`        | Acesso à API, sessão, datas e hooks.                                              |
| `src/instance.ts` | Marca da instância (crédito, banner).                                             |
| `worker/routes/`  | Rotas da API agrupadas por área (`auth`, `catalog`, `admin`).                     |
| `worker/auth/`    | Senhas, sessões, guards e limite de tentativas.                                   |
| `worker/lib/`     | Regras de domínio sem HTTP: e-mails, calendário, YouTube.                         |
| `shared/`         | Contratos (`contracts.ts`) e validação (`validation.ts`) usados pelos dois lados. |
| `migrations/`     | Schema e dados iniciais do D1, em ordem numérica.                                 |
| `tests/`          | Testes de API (D1 real via Miniflare) e de interface (jsdom).                     |

## Idioma

- **Código, nomes e comentários:** inglês.
- **Textos para o usuário, mensagens de erro da API, documentação, commits e PRs:** português.
- Textos de interface usam frases com inicial maiúscula só na primeira palavra ("Leitura individual", não "Leitura Individual").

## Backend

- **Rotas** ficam em `worker/routes/` e são montadas em `worker/index.ts`. A proteção é declarada ali, com `requireUser`, `requireMember` e `requireAdmin`, nunca dentro do handler.
- **Entrada:** todo corpo de requisição passa por `input(c, schema)` com um schema de `shared/validation.ts`. Não leia `c.req.json()` direto em rotas novas.
- **Erros:** use `HTTPException` com mensagem em português pensada para o usuário, ou `missing()` para 404. Erros inesperados caem no `onError`, que registra apenas o nome do erro.
- **SQL:** sempre `prepare(...).bind(...)`. Nomes de tabela e coluna só podem vir de constantes do código, nunca da requisição. Escritas que precisam acontecer juntas vão em `DB.batch`.
- **Respostas:** selecione as colunas explicitamente em rotas públicas ou de membros. `SELECT *` só é aceitável em rotas administrativas.
- **Efeitos externos (e-mail):** registre a tentativa no D1 antes de enviar ("claim") e trate resultado desconhecido como bloqueado, como em `worker/approval-mailer.ts`. Nunca reenvie às cegas.
- **Logs:** apenas eventos e status (`{ event, status }`). Nunca e-mails, nomes, tokens ou conteúdo de requisição.

## Contratos

- Toda resposta da API consumida pela interface tem um tipo em `shared/contracts.ts`.
- Dados públicos têm tipos próprios e reduzidos (ex.: `PublicMeeting`), em vez de reaproveitar o tipo completo.

## Frontend

- **Dados:** `useData(path)` para leituras, `save(path, body, method)` para escritas e `useSession()` para usuário e dados públicos da página inicial.
- **Proteção de tela:** `<Protected>` em `src/app.tsx` só melhora a experiência; a autorização real é sempre a do servidor.
- **Estilo:** CSS em `src/styles/global.css`, com os tokens de `:root` (`--ink`, `--muted`, `--line`, `--surface`...) e o tema escuro. **Sem `style={{}}` inline** e sem cores fixas fora dos tokens.
- **Acessibilidade:** controles com rótulo, `role="alert"`/`role="status"` para mensagens, foco gerenciado em diálogos com `useDialogFocus`, ícones decorativos com `aria-hidden`.
- **Datas:** sempre com `src/lib/dates.ts`, no fuso `America/Sao_Paulo`. O banco guarda ISO 8601 em UTC.

## Valores da instância

O código não pode conter dados de uma instalação específica. Use, nesta ordem de preferência:

1. **Banco, editável no painel** (`settings`): nome, apresentação, convites, combinados, livros, encontros.
2. **Variáveis e secrets do Wrangler:** domínio (`APP_ORIGIN`), remetente (`EMAIL_FROM`), e-mails de administração, chaves do Turnstile.
3. **`src/instance.ts`:** marca exibida na interface (crédito e banner) e o responsável e o contato da política de privacidade.

Nunca escreva no código domínios, e-mails, convites, datas de encontros ou nomes de pessoas. Migrations criam apenas schema e o conteúdo inicial documentado em [Operação](operacao.md#deploy).

## Migrations

- Arquivo novo `NNNN_descricao.sql`, com o próximo número. **Migration aplicada não é editada.**
- Adicione o arquivo à lista em `tests/helpers.ts`.
- Mudanças precisam ser compatíveis com o código em produção no intervalo entre `db:migrate:remote` e o deploy: prefira adicionar colunas com `DEFAULT` a renomear ou apagar.
- Remoção de coluna ou tabela é feita em duas entregas: primeiro o código para de usar, depois a migration remove.

## Comentários

Poucos e explicando **por quê** (uma decisão, um risco, uma regra de negócio). Não descreva o que o código já diz.
