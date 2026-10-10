# Entrega

Toda mudança chega à `main` por **branch + pull request**, inclusive as feitas por uma única pessoa. O PR é o registro público do que mudou, por quê e como foi validado.

## 1. Escopo

Antes de escrever código, defina o escopo por escrito (na issue ou no rascunho do PR):

- **Problema:** o que está errado ou faltando, e para quem.
- **Inclui:** o que esta entrega resolve.
- **Não inclui:** o que fica de fora de propósito, e onde isso vai ser tratado.
- **Critério de pronto:** como saber que funcionou (comportamento observável, não "código escrito").

Regras de tamanho:

- **Um PR, uma mudança coerente.** Se a descrição precisa de "e também", provavelmente são dois PRs.
- **Refatoração separada de mudança de comportamento.** Um PR que reorganiza código não altera o que o usuário vê, e vice-versa.
- **Atualização de dependências em PR próprio**, exceto quando a mudança depende dela.
- **Cada PR pode ir para produção sozinho.** Nada de PR que só funciona se outro for publicado junto.
- Como referência, mais de ~400 linhas alteradas (sem contar lockfile e testes) pedem uma justificativa na descrição ou uma divisão.

## 2. Branch

Crie a branch a partir da `main` atualizada:

```
<tipo>/<descricao-curta-em-kebab-case>
```

Exemplos: `feat/convite-discord`, `fix/aviso-encontro-vencido`, `docs/processo-de-entrega`.

Os tipos são os mesmos dos commits (abaixo).

## 3. Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/pt-br/), com a descrição **em português**:

```
<tipo>(<escopo>): <descrição no imperativo, minúscula, sem ponto final>

<corpo opcional: por que a mudança foi feita, não o que o diff já mostra>

<rodapé opcional: Refs #12, BREAKING CHANGE: ..., Co-Authored-By: ...>
```

| Tipo       | Uso                                                        |
| ---------- | ---------------------------------------------------------- |
| `feat`     | Nova funcionalidade visível para membros ou administração. |
| `fix`      | Correção de comportamento errado.                          |
| `security` | Correção ou endurecimento de segurança e privacidade.      |
| `refactor` | Reorganização sem mudança de comportamento.                |
| `perf`     | Melhoria de desempenho.                                    |
| `test`     | Apenas testes.                                             |
| `docs`     | Apenas documentação.                                       |
| `style`    | Formatação e CSS sem mudança de layout intencional.        |
| `build`    | Dependências, Vite, Wrangler, configuração de build.       |
| `ci`       | GitHub Actions.                                            |
| `chore`    | Manutenção que não se encaixa acima.                       |

Escopos usados: `admin`, `auth`, `catalog`, `community`, `home`, `ui`, `mailer`, `db`, `deps`, `docs`, `ci`. Omita o escopo quando a mudança for transversal.

Exemplos:

```
feat(admin): permite editar o convite do Discord
fix(home): mostra a apresentação configurada no painel
security(auth): limita tentativas de redefinição por token
build(deps): atualiza miniflare e força sharp corrigido
```

- Commits dentro da branch podem ser incrementais; o que importa é o **título do PR**, que vira a mensagem do squash.
- Mudanças feitas com auxílio do Claude Code levam o rodapé `Co-Authored-By` correspondente.
- Nunca inclua segredos, e-mails reais, convites ou dados de membros em commits — o histórico é público e permanente.

## 4. Pull request

O título segue o mesmo formato do commit. A descrição usa o [template](../.github/pull_request_template.md), que tem quatro partes obrigatórias:

1. **Contexto:** o problema e o escopo (inclui / não inclui).
2. **Mudanças:** o que foi alterado, agrupado por área, em linguagem de produto quando possível.
3. **Análise:** riscos e decisões. Responda explicitamente:
   - Expõe algum dado novo em rota pública ou para outro perfil de usuário?
   - Altera schema ou dados? A migration é compatível com o código atual em produção?
   - Exige configuração nova (secret, variável, painel) antes ou depois do deploy?
   - Quais alternativas foram descartadas e por quê?
4. **Validação:** comandos executados com resultado, testes novos e o que foi verificado manualmente (com captura de tela quando muda interface).

Antes de pedir revisão ou fazer o merge, confira a lista de **pronto**:

- [ ] `npm run verify` passa (tipos, testes, build).
- [ ] `npm run build:pages` passa; `npm run build:mailer` também, se o mailer mudou.
- [ ] `npx prettier --check .` passa.
- [ ] Comportamento novo ou corrigido tem teste (veja [Testes](testes.md)).
- [ ] Checklist de [segurança e privacidade](seguranca-privacidade.md) revisado.
- [ ] Nenhum valor da instância fixo no código (veja [Arquitetura](arquitetura.md#valores-da-instância)).
- [ ] README e documentos afetados atualizados no mesmo PR.

## 5. Merge

- **Squash merge**, com o título do PR como mensagem. A `main` fica com um commit por entrega.
- A CI precisa estar verde. Não faça merge com teste desativado ou pulado.
- Apague a branch depois do merge.

## 6. Deploy

O deploy é manual e feito depois do merge, a partir da `main` atualizada:

1. **Se houver migration:** exporte o banco para fora do repositório (`npx wrangler d1 export DB --remote --output /caminho/privado/backup.sql`) e aplique com `npm run db:migrate:remote`.
2. **Se houver configuração nova:** crie secrets e variáveis antes do deploy (a descrição do PR deve listá-los).
3. `npm run deploy` (roda o `verify`, publica o mailer e o Pages).
4. Verifique em produção o critério de pronto definido no escopo.
5. Se algo der errado, faça rollback do deploy pelo painel da Cloudflare. **Rollback não desfaz migrations**; por isso migrations precisam ser compatíveis com a versão anterior do código.

## 7. Issues de terceiros

O repositório aceita apenas **relatos de bug**, pelo template. Pedidos de funcionalidade e PRs externos são fechados com agradecimento e um link para o [CONTRIBUTING.md](../CONTRIBUTING.md). Vulnerabilidades nunca são discutidas em issues: seguem o [SECURITY.md](../SECURITY.md).
