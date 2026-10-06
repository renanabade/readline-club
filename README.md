# readline club

Código da plataforma do [readline club](https://readline.club), um clube do livro de computação: as pessoas se cadastram, são aprovadas pela organização, leem os capítulos combinados e se encontram para conversar sobre a leitura.

**Este repositório é público por transparência.** Ele existe para que membros e qualquer pessoa interessada possam ver como a plataforma funciona e como os dados são tratados. Não é um produto para instalação nem aceita contribuições externas (veja [CONTRIBUTING.md](CONTRIBUTING.md)).

## Como a plataforma funciona

- **Cadastro e aprovação.** A inscrição pede nome, e-mail e senha, além do nível de experiência e, opcionalmente, a motivação. Cada cadastro é revisado e aprovado manualmente pela organização. Quando o acesso é liberado, a pessoa recebe um e-mail de aviso.
- **Biblioteca.** Cada livro tem seu acervo, organizado em ciclos de leitura e encontros (livro → ciclo → encontro). Cada encontro reúne data, capítulos, pauta, notas, materiais e, quando houver, a gravação.
- **Encontros.** A agenda mostra os próximos encontros, que podem ser adicionados ao calendário. A página inicial anuncia o próximo encontro marcado.
- **Gravações.** Os vídeos ficam no YouTube como não listados e são exibidos dentro da plataforma para membros aprovados. Não há upload de vídeos para o site.
- **Comunidade.** Os convites do grupo no WhatsApp e do servidor no Discord são liberados para membros aprovados, depois de lerem como o clube funciona.
- **Administração.** A organização aprova, recusa ou suspende cadastros e gerencia livros, ciclos, encontros, gravações, materiais e convites pelo painel. A recuperação de senha é feita com um link de uso único, entregue em conversa privada depois de confirmar a identidade da pessoa.

## Dados e privacidade

A [política de privacidade](https://readline.club/privacidade) completa fica no site. Em resumo:

**O que é guardado:** nome, e-mail, senha (somente em formato protegido, nunca o texto original), nível de experiência, motivação informada no cadastro, status da aprovação e a confirmação de leitura das orientações da comunidade. Para limitar tentativas de login e cadastro, o endereço IP é registrado apenas em formato de hash.

**Quem vê o quê:**

| Quem                       | Acesso                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Qualquer visitante         | Nome e apresentação do clube, livros, número de membros e o anúncio do próximo encontro (título, livro, capítulos, data e duração). |
| Conta aguardando aprovação | O próprio cadastro e o status.                                                                                                      |
| Membro aprovado            | Encontros com links de chamada, gravações publicadas, materiais e convites dos grupos.                                              |
| Organização                | Os cadastros (nome, e-mail, experiência e motivação) e todo o conteúdo do painel.                                                   |

Nenhum membro vê dados de outros membros.

**Excluir a conta:** em **Minha conta**, qualquer pessoa pode excluir o próprio cadastro confirmando a senha. A exclusão apaga nome, e-mail, senha, respostas do cadastro, sessões e registros ligados à conta, e não pode ser desfeita. Os grupos de WhatsApp e Discord são serviços separados; sair deles é feito por lá.

**Serviços externos:**

- **Cloudflare:** hospedagem, banco de dados, envio de e-mails e a verificação anti-robô (Turnstile) da tela de cadastro.
- **YouTube:** as gravações são exibidas pelo player `youtube-nocookie.com`, apenas para membros aprovados.
- **Google Agenda:** só é acessado se a pessoa clicar para adicionar um encontro ao calendário.

**O que a plataforma não faz:** não tem pagamentos, anúncios de terceiros, ferramentas de análise ou rastreamento, nem login com redes sociais. O navegador guarda apenas o cookie de sessão e a preferência de tema claro/escuro. Os únicos e-mails automáticos são o aviso de aprovação e um resumo para a organização com a quantidade de cadastros pendentes, sem nomes ou endereços.

## Segurança

- Senhas protegidas com scrypt e salt individual; sessões guardadas no banco apenas como hash, em cookie HttpOnly, Secure e SameSite=Lax, com expiração em sete dias.
- Aprovação e permissões verificadas no servidor em cada acesso. Suspender uma conta encerra o acesso também nas sessões já abertas.
- Proteção contra envio de formulários por outros sites, limite de tamanho das requisições, limite de tentativas de login e cadastro, e verificação anti-robô no cadastro.
- Respostas da API não são guardadas em cache. Links de chamada, notas e gravações nunca aparecem nas respostas públicas, nem nos eventos exportados para calendário.
- Não há login de demonstração nem acesso alternativo.

Limitações conhecidas: vídeos não listados do YouTube podem ser repassados por quem tem o link, e tudo que o navegador recebe pode ser inspecionado pela própria pessoa autorizada.

Encontrou uma falha de segurança? Siga o [SECURITY.md](SECURITY.md) e não abra uma issue pública.

## Tecnologia

Interface em React, API em [Hono](https://hono.dev) sobre Cloudflare Pages Functions, banco Cloudflare D1 e validação com Zod compartilhada entre interface e servidor.

| Pasta         | Conteúdo                              |
| ------------- | ------------------------------------- |
| `src/`        | Interface.                            |
| `worker/`     | API, autenticação e envio de e-mails. |
| `functions/`  | Entrada da API no Cloudflare Pages.   |
| `shared/`     | Contratos e validações.               |
| `migrations/` | Estrutura do banco de dados.          |
| `tests/`      | Testes automatizados.                 |
| `docs/`       | Documentação interna.                 |

A direção visual usa as fontes Literata e Instrument Sans, divisórias discretas e temas claro e escuro.

## Licença

O código está sob a [licença MIT](LICENSE). As fontes em `public/fonts/` seguem a SIL Open Font License, incluída ao lado de cada arquivo. A capa em `public/covers/entendendo-algoritmos.png` pertence à editora do livro, é usada apenas para identificar a leitura e não está coberta pela licença MIT.
