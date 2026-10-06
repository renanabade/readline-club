<!-- Título no formato: tipo(escopo): descrição no imperativo. Ex.: feat(admin): permite editar o convite do Discord -->

## Contexto

<!-- Qual problema esta entrega resolve e para quem. Link para a issue, se houver. -->

**Inclui:**

**Não inclui:**

## Mudanças

<!-- O que mudou, agrupado por área (API, interface, banco, configuração, documentação). -->

## Análise

- **Dados expostos:** <!-- algum campo novo em rota pública ou para outro nível de acesso? -->
- **Banco:** <!-- migration? compatível com o código atual em produção? -->
- **Configuração:** <!-- secret, variável ou ajuste no painel antes/depois do deploy? -->
- **Riscos e alternativas:** <!-- o que pode dar errado e o que foi descartado, com o motivo. -->

## Validação

- [ ] `npm run verify`
- [ ] `npm run build:pages`
- [ ] `npm run build:mailer` (se o mailer mudou)
- [ ] `npx prettier --check .`

<!-- Testes novos, verificação manual e capturas de tela quando muda interface (sem dados reais de membros). -->

## Pronto

- [ ] Comportamento novo ou corrigido coberto por teste
- [ ] Checklist de [segurança e privacidade](https://github.com/renanabade/readline-club/blob/main/docs/seguranca-privacidade.md) revisado
- [ ] Nenhum valor da instância ou dado pessoal fixo no código
- [ ] README e `docs/` atualizados

## Deploy

<!-- Passos além de `npm run deploy`: backup, migration, secrets, verificação em produção. Escreva "Nenhum passo extra" se for o caso. -->
