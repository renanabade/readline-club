# readline club

Código da plataforma do [readline club](https://readline.club), um clube do livro de computação: as pessoas se cadastram, confirmam o e-mail, leem os capítulos combinados e se encontram para conversar sobre a leitura.

**Este repositório é público por transparência.** Ele existe para que membros e qualquer pessoa interessada possam ver como a plataforma funciona e como os dados são tratados. Não é um produto para instalação nem aceita contribuições externas (veja [CONTRIBUTING.md](CONTRIBUTING.md)).

## Como a plataforma funciona

- **Cadastro e confirmação de e-mail.** A inscrição pede nome, e-mail, celular e senha, além do nível de experiência e, opcionalmente, a motivação. O acesso à plataforma é liberado no cadastro. A pessoa recebe um link para confirmar o e-mail; abrir esse link libera o link da chamada dos encontros, os convites dos grupos, as gravações e os materiais e envia um e-mail de boas-vindas. Até lá, esses itens aparecem bloqueados, com um aviso para confirmar o e-mail. Quem digitou o e-mail errado exclui o cadastro em **Minha conta** e se inscreve de novo com o endereço certo.
- **Biblioteca.** Cada livro tem seu acervo, organizado em ciclos de leitura e encontros (livro → ciclo → encontro). Cada encontro reúne data, capítulos, pauta, notas, materiais e, quando houver, a gravação.
- **Encontros.** Os encontros são on-line. A agenda e a página inicial mostram o próximo encontro com o link da chamada, a confirmação de presença e os atalhos para o calendário. O convite por e-mail e os lembretes da véspera e de 1 hora antes trazem botões pessoais para responder a presença com um clique, sem login.
- **Gravações e acervo.** Os vídeos ficam no YouTube como não listados e são exibidos dentro da plataforma para membros com o e-mail confirmado. Cada encontro pode ter resumo escrito em PDF e EPUB, slides e transcrição, enviados como arquivo pelo painel ou publicados como links na página do encontro. Arquivos enviados aceitam só PDF e EPUB, até 20 MB, e só membros com o e-mail confirmado conseguem baixá-los.
- **Comunidade.** O grupo no WhatsApp e o servidor no Discord são os canais oficiais. Os convites são liberados para membros com o e-mail confirmado, depois de lerem como o clube funciona. As redes sociais do clube aparecem no site.
- **Administração.** A organização acompanha os cadastros, pode suspendê-los, recusá-los ou aprová-los manualmente, e gerencia livros, ciclos, encontros, gravações, materiais e convites pelo painel. Quem esquece a senha pede em **Esqueci minha senha** um link de uso único, válido por 30 minutos, enviado por e-mail; a organização também pode gerar o link no painel e entregar em conversa privada. A conta administrativa fica fora desses fluxos.

## Dados e privacidade

A [política de privacidade](https://readline.club/privacidade) completa fica no site. Em resumo:

**O que é guardado:** nome, e-mail, celular, senha (somente em formato protegido, nunca o texto original), nível de experiência, motivação informada no cadastro, status da aprovação, a confirmação de leitura das orientações da comunidade, as respostas de presença nos encontros, a presença de fato em cada encontro (registrada pela organização depois dele e visível para a própria pessoa em Minha conta), as perguntas enviadas para discussão em cada encontro e as marcações de "também quero discutir", a escolha de receber ou não os convites de encontros por e-mail e a data do primeiro clique para entrar no grupo do WhatsApp e no Discord. Também a data em que o e-mail do cadastro foi confirmado. Dos links de presença e de confirmação de e-mail, guarda-se só o hash. Para limitar tentativas de login, cadastro e recuperação de senha, o endereço IP e o e-mail são registrados apenas em formato de hash. Dos links de recuperação de senha, também se guarda só o hash.

**Quem vê o quê:**

| Quem                         | Acesso                                                                                                                                                                                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qualquer visitante           | Nome e apresentação do clube, redes sociais do clube, livros, número de membros e o anúncio do próximo encontro (título, livro, capítulos, data e duração).                                                                                                                                                      |
| Conta sem e-mail confirmado  | O próprio cadastro, encontros (sem o link da chamada), o próprio histórico de presença e as perguntas para discussão de cada encontro, com o primeiro nome de quem enviou e o total de "também quero discutir". Link da chamada, gravações, materiais e convites dos grupos aparecem bloqueados, sem o endereço. |
| Membro com e-mail confirmado | O mesmo, mais o link da chamada, as gravações publicadas, os materiais e os convites dos grupos. Contas criadas antes da confirmação de e-mail existir entram aqui.                                                                                                                                              |
| Organização                  | Os cadastros (nome, e-mail, celular, experiência e motivação), quem esteve em cada encontro, o total de confirmações de cada encontro e de cliques para entrar nos grupos (não quem) e todo o conteúdo do painel.                                                                                                |

Nenhum membro vê dados de outros membros, exceto o primeiro nome junto das perguntas que a pessoa enviou para discussão.

**Excluir a conta:** em **Minha conta**, qualquer pessoa pode excluir o próprio cadastro confirmando a senha. A exclusão apaga nome, e-mail, celular, senha, respostas do cadastro, sessões e registros ligados à conta, e não pode ser desfeita. Como os grupos de WhatsApp e Discord são exclusivos para membros, quem tinha acesso deixa só nome e celular, separados da conta, até a organização fazer a retirada dos grupos; esse registro é apagado nesse momento ou em até 30 dias.

**Serviços externos:**

- **Cloudflare:** hospedagem, banco de dados, armazenamento dos materiais enviados (R2), envio de e-mails e a verificação anti-robô (Turnstile) da tela de cadastro.
- **YouTube:** as gravações são exibidas pelo player `youtube-nocookie.com`, apenas para membros com o e-mail confirmado.
- **Transcrição e resumos:** a organização pode usar ferramentas de transcrição e de IA, fora da plataforma, sobre as gravações para preparar os resumos e slides de cada encontro.
- **Google Agenda:** só é acessado se a pessoa clicar para adicionar um encontro ao calendário, na plataforma ou no convite por e-mail. A plataforma nunca envia e-mails de membros ao Google.

**O que a plataforma não faz:** não tem pagamentos, anúncios de terceiros, ferramentas de análise ou rastreamento, nem login com redes sociais. O navegador guarda apenas o cookie de sessão, a preferência de tema claro/escuro e, se a pessoa fechar o aviso de divulgação do topo, o nome do aviso fechado. Os e-mails enviados são o link de confirmação do e-mail do cadastro, o link de recuperação de senha (só quando a pessoa pede), o aviso de aprovação, o convite de cada encontro e os lembretes da véspera e de 1 hora antes (que o membro pode desligar em **Minha conta**; quem respondeu que não vai não recebe lembrete) e um resumo para a organização com a quantidade de cadastros pendentes, sem nomes ou endereços.

## Segurança

- Senhas protegidas com scrypt e salt individual; sessões guardadas no banco apenas como hash, em cookie HttpOnly, Secure e SameSite=Lax, com expiração em sete dias.
- Aprovação e permissões verificadas no servidor em cada acesso. Suspender uma conta encerra o acesso também nas sessões já abertas.
- Proteção contra envio de formulários por outros sites, limite de tamanho das requisições, limite de tentativas de login e cadastro, e verificação anti-robô no cadastro.
- Respostas da API não são guardadas em cache. Links de chamada, notas e gravações nunca aparecem nas respostas públicas, nem nos eventos exportados para calendário.
- Não há login de demonstração nem acesso alternativo.

Limitações conhecidas: vídeos não listados do YouTube e materiais publicados por link podem ser repassados por quem tem o link, um e-mail de convite encaminhado permite que outra pessoa responda a presença daquele encontro (mas não entra na conta nem vê o link da chamada), e tudo que o navegador recebe pode ser inspecionado pela própria pessoa autorizada.

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
| `brand/`      | Marca do clube em SVG e PNG.          |

A direção visual usa as fontes Literata e Instrument Sans, divisórias discretas e temas claro e escuro.

## Licença

O código está sob a [licença MIT](LICENSE). As fontes em `public/fonts/` seguem a SIL Open Font License, incluída ao lado de cada arquivo. A capa em `public/covers/entendendo-algoritmos.png` pertence à editora do livro, é usada apenas para identificar a leitura e não está coberta pela licença MIT.
