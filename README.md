# readline club

Plataforma de um clube de leitura com cadastro por **nome, e-mail e senha**, aprovação manual, livros, ciclos de leitura, encontros e gravações do YouTube.

Este é o código do [readline.club](https://readline.club), publicado para que outros clubes possam rodar a própria instalação. O que é específico da instância oficial está reunido em [Instância readline.club](#instância-readlineclub).

O repositório é aberto por transparência e não aceita contribuições externas (veja [CONTRIBUTING.md](CONTRIBUTING.md)). O processo de desenvolvimento está em [`docs/`](docs/README.md).

Na biblioteca, cada livro tem seu próprio acervo. Os ciclos aparecem como pastas expansíveis, com filtros para todos os encontros ou apenas gravações publicadas. Cada encontro abre seu player, notas e materiais. A relação é livro → ciclo → encontro; não há upload de pastas ou vídeos para o site.

## Desenvolvimento

Requer Node.js 22 ou mais recente.

```sh
npm ci
npm run db:migrate:local
npm run dev
```

Abra http://127.0.0.1:8794. O banco local é independente do banco de produção. O comando de desenvolvimento compila a interface e inicia o Worker; após editar a interface, execute `npm run build` para atualizá-la. O Worker recarrega alterações no backend automaticamente.

Copie `.dev.vars.example` para `.dev.vars` e preencha `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET` para habilitar inscrições. Sem as chaves, o cadastro fica indisponível, sem bypass. Use um widget e segredo de testes em um ambiente isolado; a aplicação confere também hostname e action `signup`.

## Administração

A primeira conta administrativa é criada fora do cadastro público:

```sh
node scripts/bootstrap-admin.mjs --local --email organizador@exemplo.com --name "Seu nome" --output /caminho/privado/acesso.txt
```

Para produção, substitua `--local` por `--remote`. O script gera uma senha aleatória, não substitui contas existentes e exige troca no primeiro login. Guarde a saída fora do repositório. A variável protegida `ADMIN_EMAIL` reserva o endereço no cadastro público e limita o acesso administrativo a esse único e-mail. O servidor exige também o papel `admin` persistido no banco; informar o e-mail no cadastro nunca concede privilégios.

No painel é possível:

- Aprovar, recusar ou suspender integrantes.
- Aceitar todos os pendentes exibidos na lista e liberar novamente o acesso de uma pessoa suspensa. A suspensão exige confirmação.
- Cadastrar e editar livros e categorias.
- Criar ciclos e escolher a leitura atual.
- Cadastrar datas, capítulos, duração, pauta, notas e links de reunião.
- Colar links do YouTube e publicar ou retirar a publicação da gravação.
- Adicionar materiais e configurar os convites do WhatsApp e do Discord.
- Gerar um link de recuperação de senha, de uso único, válido por 30 minutos.

**Recuperação nesta versão:** a pessoa solicita ajuda ao organizador; após confirmar sua identidade pelo canal conhecido, o organizador envia o link em conversa privada. Não há envio automático de recuperação de senha. E-mails do cadastro não são verificados automaticamente, portanto confirme os novos participantes antes de aprová-los. É possível alterar a senha dentro da própria conta.

### Aviso de aprovação

A aprovação chama o Worker privado `readlineclub-mailer` por service binding. Ele verifica o status no D1, envia por Cloudflare Email Service com o remetente definido em `EMAIL_FROM` (também usado como endereço de resposta) e registra o resultado em `approval_notifications`. O Worker não tem URL pública nem preview. O Pages de preview não possui o binding de envio.

O painel diferencia acesso aprovado de aviso enviado. Para contas já aprovadas antes da integração, use **Enviar aviso de aprovação**. Erros confirmados permitem nova tentativa após um minuto; avisos aceitos pelo provedor não são repetidos. Um resultado desconhecido fica bloqueado para evitar duplicação: consulte os logs do provedor antes de qualquer intervenção. Aceitação pelo provedor não comprova chegada à caixa de entrada.

### Pendências do administrador

O mesmo Worker envia um resumo para o endereço configurado no secret `ADMIN_NOTIFY_EMAIL` às **9h e às 18h de Brasília** (`0 12,21 * * *`, em UTC). Não há e-mail por cadastro e nenhum resumo é enviado quando não há pendências. O e-mail contém apenas a quantidade e o link da administração; nomes e endereços dos inscritos ficam no painel. A tabela `admin_digest_notifications` registra cada horário e impede disparos duplicados. Falhas conhecidas podem ser tentadas novamente até três vezes no mesmo horário; resultados desconhecidos ficam bloqueados para inspeção. Não há repetição automática fora dos dois horários.

Pendentes aparecem primeiro (mais antigos antes), seguidos de integrantes aprovados, suspensos e recusados, com separação visual. **Aceitar todos** confirma uma fotografia dos IDs pendentes e envia lotes de até 20; o servidor só altera os que ainda estiverem pendentes e forem membros. Novos cadastros que chegarem depois ficam para a próxima revisão. Suspensos e recusados nunca são incluídos no lote. A liberação de uma pessoa suspensa reutiliza a conta e a senha existentes.

O domínio precisa estar habilitado e autenticado em Cloudflare Email Sending, com plano elegível. `wrangler.mailer.jsonc` restringe o remetente e preserva o link de entrada no domínio oficial. Os avisos de aprovação orientam a encontrar o botão do WhatsApp na página inicial, em O clube ou em Minha conta. Não são enviados senhas ou dados de outros membros. Respostas vão para o endereço de `EMAIL_FROM`. Os testes usam envio simulado e nunca mandam e-mails reais.

## Verificações

```sh
npm run verify
npm run build:pages
```

Testes exercitam D1 local com Miniflare, cadastro, autenticação, aprovação, suspensão, recuperação, publicação de gravações, permissões e calendário. Miniflare acompanha a versão usada pelo Wrangler; seu adaptador de opções mantém o teste compatível com o runtime instalado. As versões resolvidas ficam no lockfile.

## Deploy na Cloudflare

O arquivo `wrangler.jsonc` configura o projeto Pages `readlineclub`, com o D1 existente. `functions/api/[[path]].ts` encaminha a API para o mesmo código Hono usado nos testes e no desenvolvimento local. `APP_ORIGIN` deve corresponder exatamente à origem pública, sem barra final, e o hostname deve estar autorizado no widget Turnstile.

Para publicar a sua própria instalação, selecione a conta com `CLOUDFLARE_ACCOUNT_ID` e substitua:

- Em `wrangler.jsonc`: `database_id`, `APP_ORIGIN` e `TURNSTILE_SITE_KEY`.
- Em `wrangler.mailer.jsonc`: `database_id`, `APP_ORIGIN`, `EMAIL_FROM` e `allowed_sender_addresses`.
- Em `package.json`: o `--project-name readlineclub` dos scripts de deploy, e o mesmo nome nos comandos abaixo.
- Em `src/instance.ts`: o crédito do rodapé e o banner de divulgação (use `null` para escondê-los).
- Em `index.html`: a descrição da página.

Nome, apresentação, combinados e convites do clube são editados no painel administrativo.

```sh
npx wrangler login
npm run db:migrate:remote
npx wrangler pages secret put TURNSTILE_SECRET --project-name readlineclub
npx wrangler pages secret put ADMIN_EMAIL --project-name readlineclub
npx wrangler secret put ADMIN_NOTIFY_EMAIL --config wrangler.mailer.jsonc
npm run deploy
```

Ao criar um novo banco, as migrations adicionam apenas o livro Entendendo Algoritmos e o primeiro ciclo, sem datas, membros ou vídeos fictícios. Nunca edite migrations que já foram aplicadas. Antes de novas alterações de schema em produção, exporte o banco com `wrangler d1 export DB --remote --output backup.sql` e guarde o backup em local privado. Rollback do Worker não desfaz alterações no D1.

A integração GitHub Actions executa testes, build e compilação de Pages Functions em pushes para main e pull requests. A publicação é feita por `npm run deploy`, usando Direct Upload na branch `main`; não existe deploy automático configurado. Migrations remotas continuam uma etapa explícita anterior ao deploy quando houver schema novo. O ambiente `preview` não possui binding para o D1 de produção, e a API recusa hostnames diferentes de `APP_ORIGIN`, inclusive aliases de deployment.

Não publique a aplicação usando `wrangler deploy` sem indicar o ambiente correto.

## Segurança e privacidade

- Senhas com scrypt, salt individual e comparação constante; sessões opacas, token com hash no banco, cookie HttpOnly, Secure em HTTPS, SameSite=Lax e expiração em sete dias.
- Aprovação e papel administrativo verificados no servidor em cada acesso protegido. Suspensões têm efeito em sessões abertas.
- Escritas exigem mesma origem; requisições têm limite de tamanho. Login/cadastro contam tentativas e cadastro valida Turnstile no servidor.
- Respostas da API usam `private, no-store`. URLs de vídeo, notas e links de reunião não são incluídos no catálogo público. A página inicial anuncia apenas o próximo encontro agendado (título, livro, capítulos, data e duração), sem pauta, notas ou link da chamada.
- Nenhum login de demonstração nem mecanismo de acesso alternativo está presente em produção.
- Vídeos não listados do YouTube podem ser compartilhados por quem tem a URL. O login protege o acervo da plataforma, não impede o repasse do link.
- Os eventos exportados para calendário não contêm links privados de reunião.
- O navegador consegue inspecionar tudo que recebe para o usuário autorizado. Não há segredos de servidor no bundle, nem tokens de sessão no localStorage; esse armazenamento é usado apenas para a preferência de tema. HttpOnly limita a leitura do cookie por scripts, mas não torna o navegador do próprio usuário um ambiente secreto.
- Sem doações, pagamentos ou Google OAuth. E-mails automáticos apenas de aprovação e de resumos de pendências para o administrador.

## Estrutura e referência visual

`src/` contém a interface; `worker/`, a API; `shared/`, contratos e validações; `migrations/`, banco; `tests/`, verificações.

O favicon SVG, o ICO e os ícones para atalhos estão em `public/`, referenciados no HTML e no manifest. As versões raster podem ser regeneradas em Windows com `scripts/generate-icons.ps1`.

A direção visual foi inspirada no Eutimea, com Literata, Instrument Sans, divisórias discretas e temas claro/escuro. Os arquivos de fontes mantêm as licenças SIL Open Font License em `public/fonts/`. A capa de Entendendo Algoritmos está em `public/covers/`. Outros livros usam uma composição tipográfica provisória até terem uma capa cadastrada no código.

### Primeiro acesso do administrador

Entre em `/entrar` com a conta administrativa e a senha inicial salva no arquivo privado. A tela `/conta` exige escolher uma senha diferente da inicial; as rotas administrativas ficam bloqueadas no servidor até essa troca. Depois, abra **Minha conta → Abrir administração** para aprovar participantes e organizar o conteúdo. A barra não contém atalhos administrativos. Alterar a senha revoga sessões anteriores e links de recuperação ainda pendentes.

A recuperação pela interface atende aos membros: o administrador emite o link, confirma a identidade e compartilha em privado. Se o único administrador perder a senha, a recuperação exige intervenção técnica autenticada na Cloudflare/D1; o botão de recuperação de membros não redefine administradores. Guarde a senha em seu gerenciador. Não há envio automático de recuperação por e-mail nem recuperação pública de contas administrativas.

## Instância readline.club

Endereço oficial: **https://readline.club**. O endereço anterior em Workers redireciona os visitantes, preservando o caminho. A troca de domínio exige um novo login, com a mesma conta e senha.

O Worker antigo contém apenas `worker/legacy-redirect.ts`, publicado com `npm run deploy:legacy` (`wrangler.legacy.jsonc`). GET/HEAD redirecionam para o Pages; formulários abertos no domínio antigo recebem orientação para atualizar a página, sem reenviar credenciais automaticamente. Essa configuração não inclui o banco nem assets. `functions/_middleware.ts` aplica o mesmo redirecionamento a `readlineclub.pages.dev` e `www.readline.club`. Outras instalações não precisam desses arquivos.

## Licença

O código está sob a [licença MIT](LICENSE). As fontes em `public/fonts/` seguem a SIL Open Font License, incluída ao lado de cada arquivo. A capa em `public/covers/entendendo-algoritmos.png` pertence à editora do livro, é usada apenas para identificar a leitura e não está coberta pela licença MIT.
