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
          <strong>No cadastro:</strong> nome, e-mail, senha (somente em formato
          protegido, nunca o texto original), nível de experiência, a motivação
          que você escrever e o seu aceite das orientações do clube.
        </li>
        <li>
          <strong>Durante o uso:</strong> o status da sua inscrição, a
          confirmação de que leu como a comunidade funciona e as sessões abertas
          na sua conta.
        </li>
        <li>
          <strong>Para segurança:</strong> o endereço IP e o e-mail usados em
          tentativas de login e cadastro, guardados apenas em formato de hash,
          para limitar tentativas repetidas.
        </li>
      </ul>

      <h2>Para que usamos</h2>
      <p className="prose">
        Para avaliar sua inscrição, liberar seu acesso, avisar por e-mail quando
        ele for aprovado e manter a plataforma segura. Tratamos os dados com
        base no consentimento que você dá no cadastro e no que é necessário para
        oferecer a plataforma. Não vendemos dados, não exibimos anúncios de
        terceiros e não usamos ferramentas de análise ou rastreamento.
      </p>

      <h2>Quem vê seus dados</h2>
      <p className="prose">
        A organização do clube vê os cadastros (nome, e-mail, experiência e
        motivação) para aprovar as inscrições. Outros membros não veem seus
        dados pela plataforma. A página inicial mostra apenas o número total de
        membros.
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
          YouTube em modo de privacidade aprimorada, apenas para membros
          aprovados e só quando você abre uma gravação.
        </li>
        <li>
          <strong>Google Agenda:</strong> só é acessado se você clicar para
          adicionar um encontro ao calendário.
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
        claro ou escuro. Não usamos cookies de publicidade ou de análise.
      </p>

      <h2>Por quanto tempo</h2>
      <p className="prose">
        Enquanto sua conta existir. Quando você exclui a conta, os dados são
        apagados do banco na hora. Cópias de segurança automáticas do banco
        podem mantê-los por até 30 dias, até serem descartadas.
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
        Última atualização: 6 de outubro de 2026.
      </p>
    </div>
  );
}
