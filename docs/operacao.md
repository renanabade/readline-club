# Operação

Como rodar, administrar e publicar a plataforma. O [README](../README.md) explica o que ela é; este documento é para quem mantém.

## Ambiente local

Requer Node.js 22 ou mais recente.

```sh
npm ci
npm run db:migrate:local
npm run dev
```

Abra http://127.0.0.1:8794. O banco local é independente do banco de produção. O comando de desenvolvimento compila a interface e inicia o Worker; após editar a interface, execute `npm run build` para atualizá-la. O Worker recarrega alterações no backend automaticamente.

Copie `.dev.vars.example` para `.dev.vars` e preencha `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET` para habilitar inscrições. Sem as chaves, o cadastro fica indisponível, sem bypass. Use um widget e segredo de testes em um ambiente isolado; a aplicação confere também hostname e action `signup`.

## Conta administrativa

A primeira conta administrativa é criada fora do cadastro público:

```sh
node scripts/bootstrap-admin.mjs --local --email organizador@example.test --name "Seu nome" --output /caminho/privado/acesso.txt
```

Para produção, substitua `--local` por `--remote`. O script gera uma senha aleatória, não substitui contas existentes e exige troca no primeiro login. O script recusa um `--output` dentro do repositório, porque o arquivo contém a senha inicial. A variável protegida `ADMIN_EMAIL` reserva o endereço no cadastro público e limita o acesso administrativo a esse único e-mail. O servidor exige também o papel `admin` persistido no banco; informar o e-mail no cadastro nunca concede privilégios.

No painel é possível:

- Buscar integrantes por nome, e-mail ou celular e filtrar por situação. A lista mostra 30 por vez.
- Aprovar, recusar ou suspender integrantes.
- Ver quem excluiu a conta e precisa sair dos grupos (**Saíram da plataforma**). Depois de retirar a pessoa do WhatsApp e do Discord, **Já retirei dos grupos** apaga nome e celular; registros não tratados são apagados em 30 dias.
- Aceitar todos os pendentes exibidos na lista e liberar novamente o acesso de uma pessoa suspensa. A suspensão exige confirmação.
- Cadastrar e editar livros e categorias.
- Criar ciclos e escolher a leitura atual.
- Cadastrar datas, capítulos, duração, pauta, notas e links de reunião.
- Colar links do YouTube e publicar ou retirar a publicação da gravação.
- Adicionar materiais com tipo (resumo em PDF, resumo em EPUB, slides, transcrição ou material complementar). Resumos e slides aparecem em destaque na página do encontro e como indicação na lista de encontros do livro.
- Configurar os convites do WhatsApp e do Discord e as redes sociais do clube (Instagram, X, LinkedIn e YouTube), exibidas publicamente no site.
- Gerar um link de recuperação de senha, de uso único, válido por 30 minutos.

**Recuperação nesta versão:** a pessoa solicita ajuda ao organizador; após confirmar sua identidade pelo canal conhecido, o organizador envia o link em conversa privada. Não há envio automático de recuperação de senha. E-mails do cadastro não são verificados automaticamente, portanto confirme os novos participantes antes de aprová-los. É possível alterar a senha dentro da própria conta.

### Primeiro acesso

Entre em `/entrar` com a conta administrativa e a senha inicial salva no arquivo privado. A tela `/conta` exige escolher uma senha diferente da inicial; as rotas administrativas ficam bloqueadas no servidor até essa troca. Depois, abra **Minha conta → Abrir administração** para aprovar participantes e organizar o conteúdo. A barra não contém atalhos administrativos. Alterar a senha revoga sessões anteriores e links de recuperação ainda pendentes.

A recuperação pela interface atende aos membros: o administrador emite o link, confirma a identidade e compartilha em privado. Se o único administrador perder a senha, a recuperação exige intervenção técnica autenticada na Cloudflare/D1; o botão de recuperação de membros não redefine administradores. Guarde a senha em seu gerenciador. Não há envio automático de recuperação por e-mail nem recuperação pública de contas administrativas.

## E-mails

### Aviso de aprovação

A aprovação chama o Worker privado `readlineclub-mailer` por service binding. Ele verifica o status no D1, envia por Cloudflare Email Service com o remetente definido em `EMAIL_FROM` (também usado como endereço de resposta) e registra o resultado em `approval_notifications`. O Worker não tem URL pública nem preview. O Pages de preview não possui o binding de envio.

O painel diferencia acesso aprovado de aviso enviado. Para contas já aprovadas antes da integração, use **Enviar aviso de aprovação**. Erros confirmados permitem nova tentativa após um minuto; avisos aceitos pelo provedor não são repetidos. Um resultado desconhecido fica bloqueado para evitar duplicação: consulte os logs do provedor antes de qualquer intervenção. Aceitação pelo provedor não comprova chegada à caixa de entrada.

### Convite para encontro

No painel, cada encontro agendado e ainda não realizado tem o botão **Enviar convite por e-mail**. Depois da confirmação, a plataforma põe na fila os membros aprovados que aceitam avisos de encontros (opção em **Minha conta**, ligada por padrão) e o mailer envia em lotes de 20, pelo mesmo remetente `EMAIL_FROM`. O e-mail traz data, horário, leitura, os botões **Vou participar** e **Não vou poder**, o link para o Google Agenda e o arquivo `.ics` anexado. O link da chamada não vai no e-mail.

Os botões de resposta levam a `/presenca`, com um token individual no fragmento da URL (`#...`), que o navegador não envia ao servidor. O mailer gera o token na hora do envio e grava só o hash em `meeting_invitations.rsvp_token_hash`. A página mostra o encontro e responde com **um clique, sem login**: abrir o link não confirma nada, porque filtros de e-mail e antivírus abrem os links das mensagens. O token responde só à presença daquele encontro, para aquela pessoa, enquanto ela continuar aprovada e o encontro não tiver começado; não abre sessão e não revela o link da chamada. Reenviar o convite gera um token novo e invalida o anterior.

A tabela `meeting_invitations` registra cada convite e impede duplicação: enviar de novo só alcança quem ainda não recebeu (por exemplo, membros aprovados depois), além de repetir falhas confirmadas. Resultados desconhecidos ficam bloqueados para inspeção, como nos outros e-mails. Antes de cada envio, o mailer confere de novo se a pessoa continua aprovada e aceitando avisos. As respostas ficam em `meeting_rsvps`, e o painel mostra só os totais de cada encontro.

### Resumo de pendências

O mesmo Worker envia um resumo para o endereço do secret `ADMIN_NOTIFY_EMAIL` às **9h e às 18h de Brasília** (`0 12,21 * * *`, em UTC). Não há e-mail por cadastro e nenhum resumo é enviado quando não há pendências. O e-mail contém apenas a quantidade e o link da administração; nomes e endereços dos inscritos ficam no painel. A tabela `admin_digest_notifications` registra cada horário e impede disparos duplicados. Falhas conhecidas podem ser tentadas novamente até três vezes no mesmo horário; resultados desconhecidos ficam bloqueados para inspeção. Não há repetição automática fora dos dois horários.

Pendentes aparecem primeiro (mais antigos antes), seguidos de integrantes aprovados, suspensos e recusados, com separação visual. **Aceitar todos** confirma uma fotografia dos IDs pendentes e envia lotes de até 20; o servidor só altera os que ainda estiverem pendentes e forem membros. Novos cadastros que chegarem depois ficam para a próxima revisão. Suspensos e recusados nunca são incluídos no lote. A liberação de uma pessoa suspensa reutiliza a conta e a senha existentes.

O domínio precisa estar habilitado e autenticado em Cloudflare Email Sending, com plano elegível. `wrangler.mailer.jsonc` restringe o remetente e preserva o link de entrada no domínio oficial. Os avisos de aprovação orientam a encontrar o botão do WhatsApp na página inicial, em O clube ou em Minha conta. Não são enviados senhas ou dados de outros membros. Respostas vão para o endereço de `EMAIL_FROM`. Os testes usam envio simulado e nunca mandam e-mails reais.

## Verificações

```sh
npm run verify
npm run build:pages
```

Testes exercitam D1 local com Miniflare, cadastro, autenticação, aprovação, suspensão, recuperação, publicação de gravações, permissões e calendário. Miniflare acompanha a versão usada pelo Wrangler; seu adaptador de opções mantém o teste compatível com o runtime instalado. As versões resolvidas ficam no lockfile.

## Deploy

O arquivo `wrangler.jsonc` configura o projeto Pages `readlineclub`, com o D1 existente. `functions/api/[[path]].ts` encaminha a API para o mesmo código Hono usado nos testes e no desenvolvimento local. `APP_ORIGIN` deve corresponder exatamente à origem pública, sem barra final, e o hostname deve estar autorizado no widget Turnstile.

Os valores da instância ficam nestes lugares (veja também [Arquitetura](arquitetura.md#valores-da-instância)):

- `wrangler.jsonc`: `database_id`, `APP_ORIGIN` e `TURNSTILE_SITE_KEY`.
- `wrangler.mailer.jsonc`: `database_id`, `APP_ORIGIN`, `EMAIL_FROM` e `allowed_sender_addresses`.
- `package.json`: o projeto Pages (`--project-name readlineclub`) dos scripts de deploy.
- `src/instance.ts`: o crédito do rodapé e o banner de divulgação (`null` esconde cada um).
- `index.html`: a descrição da página.

Nome, apresentação, combinados e convites do clube são editados no painel administrativo.

```sh
npx wrangler login
npm run db:migrate:remote
npx wrangler pages secret put TURNSTILE_SECRET --project-name readlineclub
npx wrangler pages secret put ADMIN_EMAIL --project-name readlineclub
npm run deploy
```

Antes do primeiro deploy, copie `.env.mailer.example` para `.env.mailer` e preencha `ADMIN_NOTIFY_EMAIL`. O arquivo fica fora do git e é enviado como secret do mailer a cada `npm run deploy`; sem ele, o deploy do mailer falha.

Ao criar um novo banco, as migrations adicionam apenas o livro Entendendo Algoritmos e o primeiro ciclo, sem datas, membros ou vídeos fictícios. Nunca edite migrations que já foram aplicadas. Antes de novas alterações de schema em produção, exporte o banco com `npx wrangler d1 export DB --remote --output /caminho/privado/backup.sql`, sempre fora do repositório: o arquivo contém nomes, e-mails e hashes de senha de todos os membros. Rollback do Worker não desfaz alterações no D1.

A integração GitHub Actions executa testes, build e compilação de Pages Functions em pushes para main e pull requests. A publicação é feita por `npm run deploy`, usando Direct Upload na branch `main`; não existe deploy automático configurado. Migrations remotas continuam uma etapa explícita anterior ao deploy quando houver schema novo. O ambiente `preview` não possui binding para o D1 de produção, e a API recusa hostnames diferentes de `APP_ORIGIN`, inclusive aliases de deployment.

Não publique a aplicação usando `wrangler deploy` sem indicar o ambiente correto.

## Domínio e redirecionamentos

Endereço oficial: **https://readline.club**. O endereço anterior em Workers redireciona os visitantes, preservando o caminho. A troca de domínio exige um novo login, com a mesma conta e senha.

O Worker antigo contém apenas `worker/legacy-redirect.ts`, publicado com `npm run deploy:legacy` (`wrangler.legacy.jsonc`). GET/HEAD redirecionam para o Pages; formulários abertos no domínio antigo recebem orientação para atualizar a página, sem reenviar credenciais automaticamente. Essa configuração não inclui o banco nem assets. `functions/_middleware.ts` aplica o mesmo redirecionamento a `readlineclub.pages.dev` e `www.readline.club`.

## Ícones

A marca (a fita marcadora ao lado do "r") tem duas versões, com as cores exatas de cada tema: **grafite** (quadrado `#1F1D1A`, desenho `#F8F6F1`), usada no tema claro, e **papel** (quadrado `#F0EDE6`, desenho `#191814`), usada no tema escuro.

- `src/components/BrandMark.tsx`: o símbolo do cabeçalho e do rodapé, que troca de versão junto com o tema do site.
- `public/favicon.svg`: o ícone da aba, que troca de versão conforme o tema do sistema.
- `public/favicon.ico`, `icon-32.png`, `icon-192.png`, `icon-512.png` e `apple-touch-icon.png`: versão grafite. O `apple-touch-icon` não tem cantos arredondados, porque o iOS arredonda.
- `brand/`: os SVGs das duas versões e PNGs para redes sociais: `-512` com cantos arredondados e `-perfil-1080`/`-perfil-400` quadrados, para fotos de perfil (as redes recortam em círculo).
- `brand/banners/`: capas nas duas versões (`-papel` e `-grafite`): `x-header` (1500×500), `linkedin-perfil` (1584×396), `linkedin-pagina` (1128×191), `youtube` (2560×1440, com o conteúdo na área segura central), `discord` (960×540) e `compartilhamento` (1200×630, para prévia de links).

Ao mudar a marca, exporte de novo os PNG e o ICO a partir dos SVGs e aumente o `?v=` dos ícones em `index.html` e em `public/site.webmanifest`: navegadores guardam favicon em cache pelo endereço e não buscam o arquivo novo sem essa mudança.
