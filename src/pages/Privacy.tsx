import { Link } from "react-router-dom";
import { instance } from "../instance";

export default function Privacy() {
  const { controller, contact } = instance.privacy;
  return (
    <div className="container page narrow privacy-page">
      <span className="eyebrow">Política de privacidade</span>
      <h1>Como cuidamos dos seus dados.</h1>
      <p className="prose">
        Esta política explica quais dados a plataforma do readline club guarda,
        para quê, com quem são compartilhados e como você pode acessá-los ou
        excluí-los. O código da plataforma é público, então qualquer pessoa pode
        conferir o que está descrito aqui.
      </p>

      <h2>Quem é responsável</h2>
      <p className="prose">
        O responsável pelos dados é {controller}, organizador do readline club.
        Para qualquer assunto de privacidade, escreva para{" "}
        <a href={"mailto:" + contact}>{contact}</a>.
      </p>

      <h2>O que guardamos</h2>
      <ul className="prose">
        <li>
          <strong>No cadastro:</strong> nome, e-mail, celular, senha (somente em
          formato protegido, nunca o texto original), nível de experiência, a
          motivação que você escrever e o seu aceite das orientações do clube.
          Depois do cadastro, enviamos um link para confirmar o seu e-mail e
          guardamos a data da confirmação, que a organização vê no painel. O
          banco guarda só uma versão protegida (hash) desse link, que vale por 7
          dias e deixa de valer depois de usado.
        </li>
        <li>
          <strong>Durante o uso:</strong> o status da sua inscrição, a
          confirmação de que leu como a comunidade funciona, as sessões abertas
          na sua conta, suas respostas de presença nos encontros, sua escolha
          sobre receber avisos de encontros e o registro dos convites, lembretes
          e outros avisos de encontros enviados. Cada convite, lembrete e aviso
          por e-mail traz botões pessoais para responder a presença sem entrar
          na plataforma; o banco guarda apenas uma versão protegida (hash) desse
          link, que serve só para responder àquele encontro e deixa de valer
          quando ele começa.
        </li>
        <li>
          <strong>Perguntas para discussão:</strong> as perguntas que você
          enviar para um encontro e em quais perguntas você marcou &quot;também
          quero discutir&quot;.
        </li>
        <li>
          <strong>Participação:</strong> depois de cada encontro, a organização
          registra quem esteve presente, para acompanhar quem volta de um
          encontro para o outro. Você vê o seu histórico em{" "}
          <Link to="/conta">Minha conta</Link>.
        </li>
        <li>
          <strong>Acesso aos grupos:</strong> a data do primeiro clique em
          &quot;Entrar no grupo do WhatsApp&quot; e em &quot;Entrar no
          Discord&quot;, para a organização acompanhar quantas pessoas chegam
          aos grupos. O painel mostra só o total de cliques, nunca quem clicou.
          Entrar de fato no grupo acontece no próprio WhatsApp ou Discord.
        </li>
        <li>
          <strong>Para segurança:</strong> o endereço IP e o e-mail usados em
          tentativas de login, cadastro e recuperação de senha, guardados apenas
          em formato de hash, para limitar tentativas repetidas. Se você pedir
          para redefinir a senha, enviamos ao e-mail da conta um link de uso
          único, válido por 30 minutos; o banco guarda só uma versão protegida
          (hash) dele e o registro do envio.
        </li>
      </ul>

      <h2>Para que usamos</h2>
      <p className="prose">
        Para confirmar seu e-mail, liberar seu acesso, dar as boas-vindas por
        e-mail, enviar o convite, os lembretes e os avisos de cada encontro e
        manter a plataforma segura. O celular serve para a organização
        identificar você no grupo do WhatsApp do clube, que é exclusivo para
        membros. Você pode deixar de receber os convites, lembretes e avisos de
        encontros a qualquer momento em <Link to="/conta">Minha conta</Link>.
        Tratamos os dados com base no consentimento que você dá no cadastro e no
        que é necessário para oferecer a plataforma. Não vendemos dados, não
        exibimos anúncios de terceiros e não usamos ferramentas de análise ou
        rastreamento.
      </p>

      <h2>Quem vê seus dados</h2>
      <p className="prose">
        A organização do clube vê os cadastros (nome, e-mail, celular,
        experiência e motivação) para acompanhar as inscrições e cuidar dos
        grupos. Das confirmações de presença, a organização vê apenas o total de
        cada encontro, não quem respondeu. A presença registrada depois do
        encontro aparece para a organização por pessoa e para você no seu
        histórico. Outros membros não veem seus dados pela plataforma, com uma
        exceção: as perguntas para discussão que você enviar aparecem para os
        membros com o seu primeiro nome. De quem marcou &quot;também quero
        discutir&quot;, os membros e a organização veem só o total. A
        organização vê o nome completo de quem enviou cada pergunta e pode
        ocultá-la. A página inicial mostra apenas o número total de membros. Nos
        grupos do WhatsApp e do Discord, as outras pessoas veem o que esses
        serviços mostram, como seu número no WhatsApp.
      </p>

      <h2>Gravações, transcrições e resumos</h2>
      <p className="prose">
        Os encontros são gravados e publicados no YouTube como vídeos não
        listados, exibidos na plataforma só para membros. A organização pode
        usar ferramentas de transcrição e de inteligência artificial sobre a
        gravação para preparar o resumo escrito (PDF e EPUB) e os slides de cada
        encontro, que ficam na página do livro para os membros. Você pode
        participar com câmera e microfone desligados.
      </p>

      <h2>Serviços de terceiros</h2>
      <ul className="prose">
        <li>
          <strong>Cloudflare:</strong> hospeda a plataforma e o banco de dados,
          envia os e-mails e faz a verificação anti-robô do cadastro. Para isso,
          pode processar dados técnicos de acesso, como o endereço IP, inclusive
          em servidores fora do Brasil.
        </li>
        <li>
          <strong>YouTube:</strong> as gravações são exibidas pelo player do
          YouTube em modo de privacidade aprimorada, apenas para membros com o
          e-mail confirmado e só quando você abre uma gravação.
        </li>
        <li>
          <strong>Google Agenda:</strong> só é acessado se você clicar para
          adicionar um encontro ao calendário, na plataforma ou no convite por
          e-mail. Seu e-mail nunca é enviado ao Google pela plataforma.
        </li>
        <li>
          <strong>WhatsApp e Discord:</strong> os grupos do clube são serviços
          separados, com políticas próprias. Entrar ou sair deles é feito
          diretamente por lá.
        </li>
      </ul>

      <h2>Cookies e armazenamento no navegador</h2>
      <p className="prose">
        Usamos um único cookie, necessário para manter você conectado, que
        expira em sete dias. O navegador também guarda sua preferência de tema
        claro ou escuro e, se você fechar o aviso de divulgação no topo do site,
        qual aviso foi fechado, para não mostrá-lo de novo. Essas informações
        ficam só no seu navegador. Não usamos cookies de publicidade ou de
        análise.
      </p>

      <h2>Por quanto tempo</h2>
      <p className="prose">
        Enquanto sua conta existir. Quando você exclui a conta, os dados são
        apagados do banco na hora. A única exceção: se você tinha acesso aos
        grupos, seu nome e celular ficam separados da conta só até a organização
        retirar você do WhatsApp e do Discord, e são apagados nesse momento ou,
        no máximo, em 30 dias. Cópias de segurança automáticas do banco podem
        mantê-los por até 30 dias, até serem descartadas.
      </p>

      <h2>Seus direitos</h2>
      <p className="prose">
        Você pode confirmar quais dados temos sobre você, pedir uma cópia,
        corrigi-los, revogar seu consentimento e pedir a exclusão. A exclusão
        pode ser feita a qualquer momento em{" "}
        <Link to="/conta">Minha conta</Link>, confirmando sua senha. Para os
        demais pedidos, escreva para <a href={"mailto:" + contact}>{contact}</a>
        .
      </p>

      <h2>Mudanças nesta política</h2>
      <p className="prose">
        Quando esta política mudar, a nova versão será publicada nesta página.
        Última atualização: 28 de outubro de 2026.
      </p>
    </div>
  );
}
