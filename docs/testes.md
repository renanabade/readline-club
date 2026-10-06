# Testes

```sh
npm test           # todos os testes
npx vitest run tests/access.test.ts   # um arquivo
npm run verify     # tipos + testes + build (o mesmo que a CI)
```

Os testes não usam rede, e-mail real nem o banco de produção.

## O que testar

| Mudança                       | Teste obrigatório                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Rota nova                     | Caminho feliz, validação de entrada e matriz de acesso (visitante 401; pendente, recusado e suspenso 403; membro; admin). |
| Dado novo em resposta pública | Teste com valores sentinela provando que só os campos previstos aparecem (veja `tests/privacy-audit.test.ts`).            |
| Escrita                       | Rejeição sem o cabeçalho `origin` correto e efeito persistido no D1.                                                      |
| Correção de bug               | Um teste que falha antes da correção e passa depois.                                                                      |
| E-mail                        | Envio simulado, sem duplicidade em chamadas concorrentes, e conteúdo sem dados de outros membros.                         |
| Componente com regra          | Teste de interface com jsdom cobrindo cada estado (visitante, pendente, membro, admin).                                   |
| Migration                     | O arquivo entra em `tests/helpers.ts`; se ela traz regra (ex.: restrição), um teste que exercita a regra.                 |

Mudanças só de estilo ou texto não exigem teste, exceto quando um teste existente depende do texto.

## Testes de API

Use o D1 real do Miniflare:

```ts
import { beforeAll, afterAll, test, expect } from "vitest";
import { fixture, session } from "./helpers";
import { createApp } from "../worker/index";

const app = createApp();
let f: Awaited<ReturnType<typeof fixture>>;
beforeAll(async () => {
  f = await fixture();
});
afterAll(async () => {
  await f.mf.dispose();
});

test("approved members can read the catalog", async () => {
  const member = await session(f.DB); // role "member", status "approved"
  const response = await app.request(
    "/api/books",
    { headers: { cookie: member.cookie } },
    f.env,
  );
  expect(response.status).toBe(200);
});
```

- `fixture()` cria um banco novo com todas as migrations. Sempre libere com `f.mf.dispose()`.
- `session(DB, role, status)` cria uma conta com sessão válida.
- Escritas precisam de `origin: f.env.APP_ORIGIN` e `content-type: application/json`.
- Dados criados num teste e que afetam outros do mesmo arquivo devem ser removidos no final do teste.

## Testes de interface

- Comece o arquivo com `// @vitest-environment jsdom`.
- Simule a API com `vi.stubGlobal("fetch", ...)` ou a sessão com `vi.mock("../src/lib/session", ...)`.
- Busque elementos por papel e nome acessível (`getByRole("button", { name: ... })`), não por classe CSS.
- Chame `cleanup()` e `vi.unstubAllGlobals()` no `afterEach`.

## Tempo

Não use datas fixas que vão passar a ser "passado". Gere datas relativas a `Date.now()` quando a regra depende de "próximo" ou "vencido".

## Nomes

O nome do teste descreve o comportamento garantido, em inglês, como no restante dos testes: `"suspended members lose access in open sessions"`, não `"test suspend"`.
