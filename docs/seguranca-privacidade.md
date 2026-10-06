# Segurança e privacidade

O código é público e a plataforma guarda nome e e-mail de pessoas reais. Toda mudança passa por esta revisão; registre as respostas relevantes na seção **Análise** do PR.

## Princípios

- **O servidor decide.** Toda autorização acontece na API; a interface só esconde o que a pessoa não pode usar.
- **Mínimo necessário.** Cada resposta inclui apenas os campos que a tela precisa. Rotas públicas são as mais restritas.
- **Nada pessoal fora do banco.** Sem e-mails, nomes, convites ou tokens em código, logs, commits, issues ou capturas de tela de PR.
- **Falha fechada.** Sem a configuração necessária (Turnstile, binding de e-mail, `ADMIN_EMAIL`), a funcionalidade fica indisponível, sem atalho.

## Níveis de acesso

| Nível              | Pode ver                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Visitante          | Nome e apresentação do clube, livros não arquivados, contagem de membros, anúncio do próximo encontro (título, livro, capítulos, data, duração). |
| Conta não aprovada | O próprio cadastro e o status.                                                                                                                   |
| Membro aprovado    | Encontros, links de chamada, gravações publicadas, materiais, convites (após o onboarding).                                                      |
| Administrador      | Tudo, incluindo cadastros e gravações não publicadas.                                                                                            |

Qualquer mudança nesta tabela é uma decisão de produto: precisa estar explícita no PR e refletida no README.

## Checklist

**Dados e rotas**

- [ ] A rota tem o guard correto em `worker/index.ts`?
- [ ] A consulta seleciona só as colunas necessárias para esse nível de acesso?
- [ ] Há teste com sentinela provando que campos privados não vazam?
- [ ] Toda entrada passa por um schema de `shared/validation.ts`, com limites de tamanho?
- [ ] URLs aceitas são `https` e, quando possível, restritas aos domínios esperados?

**Autenticação e sessões**

- [ ] Mudanças em senha, sessão ou recuperação revogam o que deveria ser revogado?
- [ ] Endpoints que aceitam tentativas repetidas usam `rateLimit`?

**E-mails e efeitos externos**

- [ ] O envio é registrado antes e não pode duplicar em chamadas concorrentes?
- [ ] O conteúdo não inclui senhas, convites privados ou dados de outras pessoas?

**Configuração e operação**

- [ ] Algum secret ou variável novo está documentado no README e listado no PR?
- [ ] Logs novos registram só eventos e status?
- [ ] Nada da instância ou de pessoas reais foi escrito no código, nos testes ou nas fixtures (use `example.test`)?

**Dependências**

- [ ] `npm audit` continua sem vulnerabilidades?
- [ ] Dependência nova é realmente necessária e mantida?

## Vulnerabilidades

Relatos chegam pelo fluxo privado do [SECURITY.md](../SECURITY.md). A correção é feita em um PR do tipo `security`, cuja descrição não detalha como explorar a falha até o deploy estar concluído.
